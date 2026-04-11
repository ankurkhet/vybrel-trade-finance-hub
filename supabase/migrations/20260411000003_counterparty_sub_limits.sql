-- ============================================================
-- PRD Section 8: Counterparty Sub-Limits
-- Per-counterparty credit exposure caps within a facility.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.counterparty_sub_limits (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id             UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_id                 UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,

  -- Optional link to a specific funder allocation (null = applies to all funders)
  facility_funder_allocation_id UUID REFERENCES public.facility_funder_allocations(id),

  -- The counterparty this limit applies to
  counterparty_id             UUID NOT NULL,  -- references counterparties(id) — loose ref for portability
  counterparty_name           TEXT,           -- denormalized for display without join

  sub_limit_amount            NUMERIC(20, 6) NOT NULL,
  currency                    CHAR(3) NOT NULL DEFAULT 'GBP',

  -- Optional per-counterparty overrides
  max_invoice_amount          NUMERIC(20, 6),
  advance_rate_override       NUMERIC(8, 5),   -- null = use facility default

  status                      TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (facility_id, counterparty_id, currency)
);

CREATE OR REPLACE FUNCTION public.set_csl_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_csl_updated_at
  BEFORE UPDATE ON public.counterparty_sub_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_csl_updated_at();

CREATE INDEX IF NOT EXISTS csl_facility ON public.counterparty_sub_limits (facility_id);
CREATE INDEX IF NOT EXISTS csl_counterparty ON public.counterparty_sub_limits (counterparty_id);

-- RLS
ALTER TABLE public.counterparty_sub_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csl_org_select" ON public.counterparty_sub_limits
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "csl_originator_manage" ON public.counterparty_sub_limits
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================
-- counterparty_sub_limit_utilisation view
-- Real-time utilisation of each sub-limit.
-- ============================================================
CREATE OR REPLACE VIEW public.counterparty_sub_limit_utilisation AS
SELECT
  csl.id                                            AS sub_limit_id,
  csl.organization_id,
  csl.facility_id,
  csl.counterparty_id,
  csl.counterparty_name,
  csl.currency,
  csl.sub_limit_amount,
  csl.max_invoice_amount,
  csl.advance_rate_override,
  csl.status,
  COALESCE(SUM(dm.disbursement_amount), 0)          AS utilised_amount,
  GREATEST(
    csl.sub_limit_amount - COALESCE(SUM(dm.disbursement_amount), 0),
    0
  )                                                 AS available_headroom
FROM public.counterparty_sub_limits csl
-- invoices stores counterparty as TEXT (company name), join via counterparties table
LEFT JOIN public.counterparties cp ON cp.id = csl.counterparty_id
LEFT JOIN public.invoices i ON i.debtor_name = cp.company_name
LEFT JOIN public.disbursement_memos dm
  ON dm.invoice_id = i.id
  AND dm.status IN ('approved', 'disbursed')
GROUP BY
  csl.id, csl.organization_id, csl.facility_id, csl.counterparty_id,
  csl.counterparty_name, csl.currency, csl.sub_limit_amount,
  csl.max_invoice_amount, csl.advance_rate_override, csl.status;

COMMENT ON VIEW public.counterparty_sub_limit_utilisation IS
  'Real-time per-counterparty sub-limit utilisation under each facility.';
