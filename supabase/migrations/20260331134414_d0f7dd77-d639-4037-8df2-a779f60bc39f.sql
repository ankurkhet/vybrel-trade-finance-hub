ALTER TABLE public.funder_limits
  ADD COLUMN IF NOT EXISTS counterparty_id uuid REFERENCES public.counterparties(id),
  ADD COLUMN IF NOT EXISTS overall_limit numeric,
  ADD COLUMN IF NOT EXISTS limit_receivables_purchase numeric,
  ADD COLUMN IF NOT EXISTS limit_reverse_factoring numeric,
  ADD COLUMN IF NOT EXISTS limit_payable_finance numeric,
  ADD COLUMN IF NOT EXISTS scope text DEFAULT 'specific_counterparty';