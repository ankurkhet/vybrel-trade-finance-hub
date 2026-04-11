-- ============================================================
-- PRD Section 8: Extend Facilities Table
-- Add offer_letter linkage, overall limit, advance rate, validity,
-- interoperability controls, and fee fields.
-- Also adds a real-time facility_utilisation view.
-- ============================================================

ALTER TABLE public.facilities
  ADD COLUMN IF NOT EXISTS offer_letter_id         UUID REFERENCES public.offer_letters(id),
  ADD COLUMN IF NOT EXISTS overall_limit           NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS final_advance_rate      NUMERIC(8, 5) DEFAULT 80.00,
  ADD COLUMN IF NOT EXISTS final_discounting_rate  NUMERIC(8, 5) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valid_from              DATE,
  ADD COLUMN IF NOT EXISTS valid_to                DATE,
  ADD COLUMN IF NOT EXISTS max_invoice_amount      NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS interoperability_allowed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interoperability_max_pct NUMERIC(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overdue_fee_pct         NUMERIC(8, 5) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee_pct        NUMERIC(8, 5) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at              TIMESTAMPTZ;

-- Backfill updated_at
UPDATE public.facilities SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE public.facilities ALTER COLUMN updated_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.set_facility_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_facility_updated_at ON public.facilities;
CREATE TRIGGER trg_facility_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW EXECUTE FUNCTION public.set_facility_updated_at();

-- ============================================================
-- facility_utilisation view
-- Real-time: sums approved disbursement_memos for each facility.
-- Shows overall_limit, utilised_amount, available_headroom.
-- ============================================================
CREATE OR REPLACE VIEW public.facility_utilisation AS
SELECT
  f.id                                      AS facility_id,
  f.organization_id,
  f.borrower_id,
  f.product_type,
  f.currency,
  f.overall_limit,
  f.final_advance_rate,
  f.valid_from,
  f.valid_to,
  f.interoperability_allowed,
  f.interoperability_max_pct,
  f.max_invoice_amount,
  COALESCE(SUM(dm.disbursement_amount), 0)  AS utilised_amount,
  GREATEST(
    COALESCE(f.overall_limit, 0) - COALESCE(SUM(dm.disbursement_amount), 0),
    0
  )                                         AS available_headroom
FROM public.facilities f
LEFT JOIN public.invoices i
  ON i.borrower_id = f.borrower_id
  AND i.currency = f.currency
LEFT JOIN public.disbursement_memos dm
  ON dm.invoice_id = i.id
  AND dm.status IN ('approved', 'disbursed')
  AND dm.journals_posted = false OR dm.journals_posted = true  -- include all active disbursements
GROUP BY
  f.id, f.organization_id, f.borrower_id, f.product_type,
  f.currency, f.overall_limit, f.final_advance_rate,
  f.valid_from, f.valid_to, f.interoperability_allowed,
  f.interoperability_max_pct, f.max_invoice_amount;

COMMENT ON VIEW public.facility_utilisation IS
  'Real-time utilisation per facility. utilised_amount = sum of approved/disbursed disbursement_memos for invoices under this facility borrower+currency scope.';
