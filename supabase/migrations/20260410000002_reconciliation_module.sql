-- ============================================================
-- Reconciliation Module
-- Bank statement uploads + match tracking.
-- Weekly cron reminds credit manager to reconcile.
-- PSP day-end auto-reconciliation hooks into same flow.
-- Depends on: 20260410000000_disbursement_psp_manual_flow.sql
-- ============================================================

-- 1. Bank statement uploads
CREATE TABLE IF NOT EXISTS public.bank_statement_uploads (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_path                TEXT NOT NULL,          -- Supabase storage path in 'bank-statements' bucket
  file_name                TEXT NOT NULL,
  file_type                TEXT NOT NULL CHECK (file_type IN ('csv', 'pdf', 'psp_auto')),
  upload_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  statement_from_date      DATE,
  statement_to_date        DATE,
  status                   TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  parsed_lines             JSONB,
    -- Array of: { date, description, amount, reference, raw_line }
  total_lines              INTEGER,
  matched_lines            INTEGER DEFAULT 0,
  unmatched_lines          INTEGER DEFAULT 0,
  exception_lines          INTEGER DEFAULT 0,
  error_message            TEXT,
  -- Optional link to a specific disbursement advice (Gap 1 manual flow)
  disbursement_advice_id   UUID REFERENCES public.disbursement_advices(id),
  uploaded_by              UUID REFERENCES auth.users(id),
  processed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statement_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_stmt_org_select" ON public.bank_statement_uploads
  FOR SELECT TO authenticated
  USING (organization_id = public.get_org_from_jwt() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "bank_stmt_ops_manage" ON public.bank_statement_uploads
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operations_manager'::app_role)
    OR has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS bank_stmt_org_date ON public.bank_statement_uploads (organization_id, upload_date DESC);
CREATE INDEX IF NOT EXISTS bank_stmt_status ON public.bank_statement_uploads (status) WHERE status != 'processed';

-- 2. Reconciliation matches (one row per parsed statement line)
CREATE TABLE IF NOT EXISTS public.reconciliation_matches (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bank_statement_upload_id    UUID NOT NULL REFERENCES public.bank_statement_uploads(id) ON DELETE CASCADE,
  statement_line_index        INTEGER NOT NULL,    -- index into parsed_lines array
  statement_date              DATE,
  statement_amount            NUMERIC(20,6),
  statement_reference         TEXT,
  statement_description       TEXT,
  -- Matched system record (at most one will be non-null)
  payment_instruction_id      UUID REFERENCES public.payment_instructions(id),
  journal_id                  UUID REFERENCES public.journals(id),
  -- Match outcome
  match_type                  TEXT NOT NULL DEFAULT 'unmatched'
    CHECK (match_type IN ('auto_matched', 'manually_matched', 'unmatched', 'exception')),
  match_confidence            NUMERIC(5,2),        -- 0–100
  match_notes                 TEXT,
  matched_by                  UUID REFERENCES auth.users(id),
  matched_at                  TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recon_matches_org_select" ON public.reconciliation_matches
  FOR SELECT TO authenticated
  USING (organization_id = public.get_org_from_jwt() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "recon_matches_ops_manage" ON public.reconciliation_matches
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operations_manager'::app_role)
    OR has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS recon_matches_upload ON public.reconciliation_matches (bank_statement_upload_id);
CREATE INDEX IF NOT EXISTS recon_matches_type ON public.reconciliation_matches (match_type);
CREATE INDEX IF NOT EXISTS recon_matches_payment ON public.reconciliation_matches (payment_instruction_id) WHERE payment_instruction_id IS NOT NULL;

-- 3. Summary view for the reconciliation UI
CREATE OR REPLACE VIEW public.reconciliation_summary AS
SELECT
  u.id                  AS upload_id,
  u.organization_id,
  u.file_name,
  u.upload_date,
  u.statement_from_date,
  u.statement_to_date,
  u.status,
  u.total_lines,
  u.matched_lines,
  u.unmatched_lines,
  u.exception_lines,
  u.uploaded_by,
  u.created_at,
  COUNT(m.id) FILTER (WHERE m.match_type = 'auto_matched')     AS auto_matched,
  COUNT(m.id) FILTER (WHERE m.match_type = 'manually_matched') AS manually_matched,
  COUNT(m.id) FILTER (WHERE m.match_type = 'unmatched')        AS unmatched,
  COUNT(m.id) FILTER (WHERE m.match_type = 'exception')        AS exceptions
FROM public.bank_statement_uploads u
LEFT JOIN public.reconciliation_matches m ON m.bank_statement_upload_id = u.id
GROUP BY u.id;

-- 4. Weekly reconciliation reminder cron (Monday 08:00 UTC)
-- Inserts a workflow_event_queue row per org that has operations_manager users
CREATE OR REPLACE FUNCTION public.invoke_weekly_reconciliation_reminder()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- Insert one reminder per distinct org with an operations_manager user
  INSERT INTO public.workflow_event_queue (
    organization_id,
    table_name,
    record_id,
    event_type,
    old_status,
    new_status
  )
  SELECT DISTINCT
    p.organization_id,
    'reconciliation_reminder',
    gen_random_uuid(),
    'weekly_reconciliation_due',
    NULL,
    'pending'
  FROM public.user_roles ur
  JOIN public.profiles p ON p.user_id = ur.user_id
  WHERE ur.role = 'operations_manager'
    AND p.organization_id IS NOT NULL;
END;
$$;

-- Remove existing schedule if present
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-reconciliation-reminder') THEN
    PERFORM cron.unschedule('weekly-reconciliation-reminder');
  END IF;
END $$;

SELECT cron.schedule(
  'weekly-reconciliation-reminder',
  '0 8 * * 1',   -- 08:00 UTC every Monday
  'SELECT public.invoke_weekly_reconciliation_reminder()'
);

-- 5. Register reconcile-bank-statement in platform_api_configs (if table exists)
INSERT INTO public.platform_api_configs
  (api_name, display_name, category, description, requires_secrets, cron_schedule, is_active, verify_jwt)
VALUES
  ('reconcile-bank-statement', 'Reconcile Bank Statement',
   'settlement',
   'Parses uploaded bank statement (CSV or PDF) and auto-matches lines to payment instructions. Also handles PSP day-end batch reconciliation.',
   ARRAY[]::TEXT[], NULL, true, false),
  ('process-disbursement', 'Process Disbursement',
   'settlement',
   'On disbursement approval: routes to PSP if configured, else creates a disbursement advice for manual credit manager confirmation. Posts journals only on completion.',
   ARRAY[]::TEXT[], NULL, true, false)
ON CONFLICT (api_name) DO NOTHING;
