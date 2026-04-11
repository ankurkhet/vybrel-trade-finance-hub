-- ============================================================
-- Offer Letter Fee Validity + Settlement Fee Resolution Tracking
-- Adds fee_valid_from / fee_valid_to to offer_letters so the
-- generate-settlement function can pick the correct fee at
-- the time the disbursement was issued, not the collection date.
-- Also adds fee_resolution_source to settlement_advices.
-- ============================================================

ALTER TABLE public.offer_letters
  ADD COLUMN IF NOT EXISTS fee_valid_from  DATE,
  ADD COLUMN IF NOT EXISTS fee_valid_to    DATE;

COMMENT ON COLUMN public.offer_letters.fee_valid_from IS
  'Start of the fee validity window. generate-settlement uses the fee in force at disbursement issue time.';
COMMENT ON COLUMN public.offer_letters.fee_valid_to IS
  'End of fee validity. If collection happens after this date, fee at disbursement issue time is still used.';

ALTER TABLE public.settlement_advices
  ADD COLUMN IF NOT EXISTS fee_resolution_source TEXT
    CHECK (fee_resolution_source IN ('offer_letter', 'offer_letter_fallback', 'product_fee_config', 'failed')),
  ADD COLUMN IF NOT EXISTS disbursement_memo_id  UUID REFERENCES public.disbursement_memos(id);

COMMENT ON COLUMN public.settlement_advices.fee_resolution_source IS
  'Records which step of the fee resolution chain was used: offer_letter (direct), offer_letter_fallback (at disbursement time), product_fee_config (emergency fallback), failed (no fee found — high alert raised).';

COMMENT ON COLUMN public.settlement_advices.disbursement_memo_id IS
  'Link back to the disbursement that funded this invoice. Enables full transaction chain: REQ → DIS → DAV → COL → SBW/SFD.';

-- Index for fee resolution query pattern (borrower + product + date range)
CREATE INDEX IF NOT EXISTS offer_letters_fee_validity
  ON public.offer_letters (borrower_id, product_type, fee_valid_from, fee_valid_to)
  WHERE status IN ('active', 'issued');

-- Index for settlement → disbursement linkage
CREATE INDEX IF NOT EXISTS settlement_advices_disbursement
  ON public.settlement_advices (disbursement_memo_id)
  WHERE disbursement_memo_id IS NOT NULL;
