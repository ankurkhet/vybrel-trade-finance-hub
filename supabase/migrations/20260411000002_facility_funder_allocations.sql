-- ============================================================
-- PRD Section 8: Facility Funder Allocations
-- Multi-funder backing per facility, full rate stack hidden from borrower.
-- Supersedes facility_funder_pricing for new work (old table retained for
-- backwards compatibility with existing data).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facility_funder_allocations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id               UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  funder_user_id            UUID NOT NULL REFERENCES auth.users(id),

  -- Allocation sizing
  allocated_limit           NUMERIC(20, 6) NOT NULL,
  currency                  CHAR(3) NOT NULL DEFAULT 'GBP',

  -- Full rate stack (hidden from borrower)
  base_rate_type            TEXT NOT NULL DEFAULT 'Fixed Rate'
    CHECK (base_rate_type IN ('Fixed Rate', 'SOFR', 'SONIA', 'EURIBOR-3M', 'BOE', 'Other')),
  base_rate_value           NUMERIC(10, 5) NOT NULL DEFAULT 0,
  funder_margin             NUMERIC(10, 5) NOT NULL DEFAULT 0,
  originator_margin         NUMERIC(10, 5) NOT NULL DEFAULT 0,
  broker_margin             NUMERIC(10, 5) NOT NULL DEFAULT 0,
  final_discounting_rate    NUMERIC(10, 5) GENERATED ALWAYS AS (
    COALESCE(base_rate_value, 0)
    + COALESCE(funder_margin, 0)
    + COALESCE(originator_margin, 0)
    + COALESCE(broker_margin, 0)
  ) STORED,
  advance_rate              NUMERIC(8, 5) DEFAULT 80.00,
  overdue_fee_pct           NUMERIC(8, 5) DEFAULT 0,

  -- Scope: all counterparties of borrower, or one specific counterparty
  scope                     TEXT NOT NULL DEFAULT 'all_counterparties'
    CHECK (scope IN ('all_counterparties', 'specific_counterparty')),
  counterparty_id           UUID,   -- null when scope = 'all_counterparties'

  -- Funder approval gate (when funder MSA requires_funder_approval = true)
  requires_funder_approval  BOOLEAN NOT NULL DEFAULT false,
  funder_approved_at        TIMESTAMPTZ,
  funder_approved_by        UUID REFERENCES auth.users(id),

  status                    TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'closed')),

  valid_from                DATE,
  valid_to                  DATE,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_ffa_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_ffa_updated_at
  BEFORE UPDATE ON public.facility_funder_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_ffa_updated_at();

CREATE INDEX IF NOT EXISTS ffa_facility ON public.facility_funder_allocations (facility_id);
CREATE INDEX IF NOT EXISTS ffa_funder ON public.facility_funder_allocations (funder_user_id);
CREATE INDEX IF NOT EXISTS ffa_status ON public.facility_funder_allocations (status) WHERE status = 'active';

-- RLS
ALTER TABLE public.facility_funder_allocations ENABLE ROW LEVEL SECURITY;

-- Originators see all allocations for their org
CREATE POLICY "ffa_org_select" ON public.facility_funder_allocations
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Funders see their own allocations
CREATE POLICY "ffa_funder_select" ON public.facility_funder_allocations
  FOR SELECT TO authenticated
  USING (funder_user_id = auth.uid());

-- Only originator_admin can manage
CREATE POLICY "ffa_originator_manage" ON public.facility_funder_allocations
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Funders can approve their own allocations
CREATE POLICY "ffa_funder_approve" ON public.facility_funder_allocations
  FOR UPDATE TO authenticated
  USING (
    funder_user_id = auth.uid()
    AND requires_funder_approval = true
    AND funder_approved_at IS NULL
  );

-- ============================================================
-- funder_allocation_utilisation view
-- Per-funder-allocation utilisation (total disbursed vs allocated_limit).
-- ============================================================
CREATE OR REPLACE VIEW public.funder_allocation_utilisation AS
SELECT
  ffa.id                                        AS allocation_id,
  ffa.organization_id,
  ffa.facility_id,
  ffa.funder_user_id,
  ffa.currency,
  ffa.allocated_limit,
  ffa.final_discounting_rate,
  ffa.advance_rate,
  ffa.scope,
  ffa.status,
  COALESCE(SUM(dm.disbursement_amount), 0)      AS utilised_amount,
  GREATEST(
    ffa.allocated_limit - COALESCE(SUM(dm.disbursement_amount), 0),
    0
  )                                             AS available_headroom
FROM public.facility_funder_allocations ffa
LEFT JOIN public.disbursement_memos dm
  ON dm.funder_limit_id IN (
    SELECT fl.id FROM public.funder_limits fl
    WHERE fl.funder_user_id = ffa.funder_user_id
  )
  AND dm.status IN ('approved', 'disbursed')
GROUP BY
  ffa.id, ffa.organization_id, ffa.facility_id, ffa.funder_user_id,
  ffa.currency, ffa.allocated_limit, ffa.final_discounting_rate,
  ffa.advance_rate, ffa.scope, ffa.status;

COMMENT ON VIEW public.funder_allocation_utilisation IS
  'Real-time per-funder allocation utilisation against allocated_limit.';
