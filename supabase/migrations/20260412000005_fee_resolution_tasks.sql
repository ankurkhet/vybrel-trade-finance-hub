-- ============================================================
-- Fee Resolution Tasks
-- Created when generate-settlement cannot resolve a fee (Step 4
-- of the 4-step chain). Originator Admin can either:
--   (a) Enter rates manually to unblock the settlement, or
--   (b) Update the facility / offer letter and retry.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fee_resolution_tasks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Source transaction
  collection_id           UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  invoice_id              UUID REFERENCES public.invoices(id),
  borrower_id             UUID REFERENCES public.borrowers(id),
  product_type            TEXT,
  collection_amount       NUMERIC(20,6),
  currency                CHAR(3) DEFAULT 'GBP',

  -- Alert state
  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved', 'dismissed')),
  failure_reason          TEXT,          -- human-readable: "No offer letter found at collection date 2026-04-11"

  -- Resolution: manually entered rates (Option A)
  override_originator_fee_pct  NUMERIC(8,5),
  override_discount_rate       NUMERIC(8,5),
  override_platform_fee_pct    NUMERIC(8,5),
  override_broker_fee_pct      NUMERIC(8,5),
  resolution_type         TEXT           -- 'manual_override' | 'retry' | 'dismissed'
    CHECK (resolution_type IN ('manual_override', 'retry', 'dismissed')),

  -- Audit
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at             TIMESTAMPTZ,
  resolved_by             UUID REFERENCES auth.users(id),
  settlement_advice_id    UUID           -- set after successful settlement
);

CREATE INDEX IF NOT EXISTS fee_resolution_tasks_org ON public.fee_resolution_tasks (organization_id, status);
CREATE INDEX IF NOT EXISTS fee_resolution_tasks_collection ON public.fee_resolution_tasks (collection_id);

ALTER TABLE public.fee_resolution_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fee_res_org_select" ON public.fee_resolution_tasks
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "fee_res_originator_manage" ON public.fee_resolution_tasks
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
