-- ============================================================
-- GAP E + GAP B: Disbursement memo enhancements
-- Gap E: borrower_requested_amount — originator can see what borrower asked for
-- Gap B: funder_limit_id — links disbursement to specific funder rate card
-- ============================================================

ALTER TABLE public.disbursement_memos
  ADD COLUMN IF NOT EXISTS borrower_requested_amount NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS funder_limit_id UUID REFERENCES public.funder_limits(id);

COMMENT ON COLUMN public.disbursement_memos.borrower_requested_amount IS
  'Copied from invoices.requested_funding_amount at disbursement creation time. The amount the borrower asked for.';

COMMENT ON COLUMN public.disbursement_memos.funder_limit_id IS
  'The specific funder rate card (funder_limits row) used for this disbursement. Links funding offer to transaction.';
