-- ============================================================
-- GAP D: Borrower Requests Specific Funding Amount
-- Borrower can specify how much of the eligible advance they want funded.
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS requested_funding_amount NUMERIC(20,6),
  ADD COLUMN IF NOT EXISTS requested_funding_currency CHAR(3);
