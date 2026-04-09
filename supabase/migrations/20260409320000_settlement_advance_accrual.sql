-- Settlement Advance / Accrual Schema
-- Adds settlement_type, advance_paid, and remaining_balance to settlement_advices
-- so the generate-settlement function can model the two settlement modes correctly.
--
-- advance  — borrower received % of face value upfront at disbursement; settlement
--            pays only the residual (face minus advance minus all fees).
-- accrual  — full settlement paid on collection date (current default behaviour).

ALTER TABLE public.settlement_advices
  ADD COLUMN IF NOT EXISTS settlement_type     TEXT    DEFAULT 'accrual'
    CHECK (settlement_type IN ('advance', 'accrual')),
  ADD COLUMN IF NOT EXISTS advance_paid        NUMERIC(20, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_balance   NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS net_margin_amount   NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS net_margin_pct      NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS negative_margin     BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.settlement_advices.settlement_type IS
  'accrual = full settlement at collection; advance = residual after upfront disbursement';
COMMENT ON COLUMN public.settlement_advices.advance_paid IS
  'Amount already disbursed to borrower at funding time (advance settlement only)';
COMMENT ON COLUMN public.settlement_advices.remaining_balance IS
  'net_amount minus advance_paid; what the borrower actually receives at settlement';
COMMENT ON COLUMN public.settlement_advices.negative_margin IS
  'True when platform net margin on this settlement is negative — triggers alert';
