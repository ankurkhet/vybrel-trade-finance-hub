-- ============================================================
-- Disbursement PSP-or-Manual Flow
-- Adds psp_configs (per-org PSP setup) and disbursement_advices
-- (manual confirmation workflow when no PSP is active).
-- Ledger entries post ONLY on credit manager "completed" action.
-- ============================================================

-- 1. PSP configuration per organization
CREATE TABLE IF NOT EXISTS public.psp_configs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  psp_provider         TEXT NOT NULL CHECK (psp_provider IN ('modulr', 'railsr', 'stripe', 'manual')),
  api_base_url         TEXT,
  credentials_vault_key TEXT,      -- Supabase vault secret name — never store credentials here
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)           -- one active PSP per org at a time
);

ALTER TABLE public.psp_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psp_configs_org_select" ON public.psp_configs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_org_from_jwt() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "psp_configs_admin_manage" ON public.psp_configs
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 2. Disbursement advices (manual flow — created when no active PSP)
CREATE TABLE IF NOT EXISTS public.disbursement_advices (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id              UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  disbursement_memo_id         UUID NOT NULL REFERENCES public.disbursement_memos(id),
  advice_number                TEXT NOT NULL UNIQUE,
  status                       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'bank_statement_uploaded', 'completed', 'cancelled')),
  -- Bank statement upload (filled by credit manager)
  bank_statement_path          TEXT,
  bank_statement_uploaded_at   TIMESTAMPTZ,
  bank_statement_uploaded_by   UUID REFERENCES auth.users(id),
  -- AI match result after parsing bank statement
  ai_match_result              JSONB,
    -- { matched: bool, statement_reference: string, statement_amount: number,
    --   statement_date: string, confidence: number }
  -- Completion (triggers journal posting)
  completed_at                 TIMESTAMPTZ,
  completed_by                 UUID REFERENCES auth.users(id),
  payment_reference            TEXT,   -- confirmed bank reference
  notes                        TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.disbursement_advices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disb_advices_org_select" ON public.disbursement_advices
  FOR SELECT TO authenticated
  USING (organization_id = public.get_org_from_jwt() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "disb_advices_ops_manage" ON public.disbursement_advices
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'operations_manager'::app_role)
    OR has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS disb_advices_memo ON public.disbursement_advices (disbursement_memo_id);
CREATE INDEX IF NOT EXISTS disb_advices_status ON public.disbursement_advices (status) WHERE status != 'completed';

-- Auto-generate advice number on insert
CREATE SEQUENCE IF NOT EXISTS public.disbursement_advice_seq START 1000;

CREATE OR REPLACE FUNCTION public.set_disbursement_advice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.advice_number IS NULL OR NEW.advice_number = '' THEN
    NEW.advice_number := 'DA-' || to_char(now(), 'YYYYMMDD') || '-'
      || lpad(nextval('public.disbursement_advice_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_disbursement_advice_number
  BEFORE INSERT ON public.disbursement_advices
  FOR EACH ROW EXECUTE FUNCTION public.set_disbursement_advice_number();

-- 3. Extend disbursement_memos with flow mode + PSP link
ALTER TABLE public.disbursement_memos
  ADD COLUMN IF NOT EXISTS disbursement_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (disbursement_mode IN ('psp', 'manual')),
  ADD COLUMN IF NOT EXISTS psp_payment_instruction_id UUID REFERENCES public.payment_instructions(id),
  ADD COLUMN IF NOT EXISTS journals_posted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.disbursement_memos.disbursement_mode IS
  'psp = auto-submitted via PSP API; manual = disbursement advice created for credit manager';
COMMENT ON COLUMN public.disbursement_memos.journals_posted IS
  'True once post_journal_batch has been called for this disbursement';
