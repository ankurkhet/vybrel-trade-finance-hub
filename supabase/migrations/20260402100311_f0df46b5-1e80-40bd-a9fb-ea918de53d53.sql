
-- ============================================================
-- SPRINT 1: CRITICAL PRODUCTION FIXES
-- ============================================================

-- 1. Reconcile funder_relationships columns (fix duplicate migration issue)
-- Add any columns that might be missing due to migration ordering
ALTER TABLE public.funder_relationships
  ADD COLUMN IF NOT EXISTS master_base_rate_type TEXT,
  ADD COLUMN IF NOT EXISTS master_base_rate_value NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS master_margin_pct NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS margin_receivable_purchase NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS margin_reverse_factoring NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS margin_payable_finance NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS base_rate_type TEXT;

-- 2. Reconcile funder_kyc columns
ALTER TABLE public.funder_kyc
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS aml_policy_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pep_screening_confirmed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sanctions_screening_confirmed BOOLEAN DEFAULT false;

-- 3. Add missing dunning columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS accrued_late_fees NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dunning_date DATE;

-- 4. Create document_templates table (was missing entirely)
CREATE TABLE IF NOT EXISTS public.document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'general',
  content TEXT,
  file_path TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- Correct RLS using get_user_organization_id (NOT user_roles.organization_id)
CREATE POLICY "Admins can manage all document templates"
  ON public.document_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins can manage org document templates"
  ON public.document_templates FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    AND organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "Org members can view org document templates"
  ON public.document_templates FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_document_templates_updated_at
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Fix pg_cron: create a safe wrapper that won't block migrations
-- Replace the accrue_daily_interest function with one that handles missing columns gracefully
CREATE OR REPLACE FUNCTION public.accrue_daily_interest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv RECORD;
  _overdue_rate NUMERIC;
  _daily_rate NUMERIC;
  _accrual NUMERIC;
BEGIN
  FOR _inv IN
    SELECT i.id, i.amount, i.due_date, i.accrued_late_fees,
           fr.metadata->>'overdue_fee_pct' AS overdue_fee_pct_meta
    FROM invoices i
    LEFT JOIN disbursement_memos dm ON dm.invoice_id = i.id
    LEFT JOIN facility_requests fr ON fr.id = dm.facility_request_id
    WHERE i.status IN ('funded', 'partially_settled')
      AND i.due_date < CURRENT_DATE
  LOOP
    -- Get overdue rate: try facility metadata, then default 0
    _overdue_rate := COALESCE((_inv.overdue_fee_pct_meta)::NUMERIC, 0);
    IF _overdue_rate <= 0 THEN
      CONTINUE;
    END IF;

    _daily_rate := _overdue_rate / 36500.0;
    _accrual := _inv.amount * _daily_rate;

    UPDATE invoices
    SET accrued_late_fees = COALESCE(accrued_late_fees, 0) + _accrual,
        last_dunning_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = _inv.id;
  END LOOP;
END;
$$;
