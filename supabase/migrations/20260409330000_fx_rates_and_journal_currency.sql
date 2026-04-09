-- FX Rates Table and Multi-Currency Journal Validation
-- Adds a structured FX rates table for cross-currency transactions
-- and updates post_journal_batch() to enforce single-currency batches.

-- 1. FX Rates Table
CREATE TABLE IF NOT EXISTS public.fx_rates (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency CHAR(3) NOT NULL,
  to_currency   CHAR(3) NOT NULL,
  rate          NUMERIC(20, 8) NOT NULL,  -- units of to_currency per 1 from_currency
  as_of_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  source        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_currency, to_currency, (as_of_date::date))
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

-- Public read — rates are not sensitive
CREATE POLICY "fx_rates_read" ON public.fx_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "fx_rates_admin_write" ON public.fx_rates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed common GBP pairs (static bootstrap — refreshed by fetch-market-rates)
INSERT INTO public.fx_rates (from_currency, to_currency, rate, source)
VALUES
  ('GBP', 'USD', 1.27000000, 'bootstrap'),
  ('GBP', 'EUR', 1.17000000, 'bootstrap'),
  ('USD', 'GBP', 0.78740157, 'bootstrap'),
  ('EUR', 'GBP', 0.85470085, 'bootstrap'),
  ('USD', 'EUR', 0.92000000, 'bootstrap'),
  ('EUR', 'USD', 1.08695652, 'bootstrap')
ON CONFLICT (from_currency, to_currency, (as_of_date::date)) DO NOTHING;

-- Helper: Get latest FX rate between two currencies (returns NULL if same currency)
CREATE OR REPLACE FUNCTION public.get_fx_rate(p_from CHAR(3), p_to CHAR(3))
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_from = p_to THEN 1.0
    ELSE (
      SELECT rate
      FROM public.fx_rates
      WHERE from_currency = p_from AND to_currency = p_to
      ORDER BY as_of_date DESC
      LIMIT 1
    )
  END;
$$;

-- Helper: Convert amount to GBP equivalent using latest FX rate
CREATE OR REPLACE FUNCTION public.to_gbp_equivalent(p_amount NUMERIC, p_currency CHAR(3))
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p_amount * COALESCE(public.get_fx_rate(p_currency, 'GBP'), 1.0);
$$;

-- 2. GBP-equivalent wallet summary view per actor
CREATE OR REPLACE VIEW public.wallets_gbp_summary AS
SELECT
  COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::UUID) AS actor_id,
  system_account,
  organization_id,
  SUM(
    public.to_gbp_equivalent(
      CASE WHEN direction = 'credit' THEN amount ELSE -amount END,
      currency
    )
  ) AS balance_gbp,
  MAX(created_at) AS last_updated_at
FROM public.journals
GROUP BY account_id, system_account, organization_id;

-- 3. Update post_journal_batch() to enforce single-currency per batch
CREATE OR REPLACE FUNCTION public.post_journal_batch(entries jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_debit   NUMERIC := 0;
  total_credit  NUMERIC := 0;
  entry         jsonb;
  currencies    TEXT[];
  batch_currency TEXT;
BEGIN
  -- Collect distinct currencies in this batch
  SELECT ARRAY_AGG(DISTINCT entry_val->>'currency')
  INTO currencies
  FROM jsonb_array_elements(entries) AS entry_val;

  -- Reject multi-currency batches — each currency must be a separate atomic batch
  IF array_length(currencies, 1) > 1 THEN
    RAISE EXCEPTION
      'Journal batch contains mixed currencies: %. Use one batch per currency.',
      array_to_string(currencies, ', ');
  END IF;

  -- Validate debit = credit
  FOR entry IN SELECT * FROM jsonb_array_elements(entries)
  LOOP
    IF entry->>'direction' = 'debit' THEN
      total_debit := total_debit + (entry->>'amount')::NUMERIC;
    ELSIF entry->>'direction' = 'credit' THEN
      total_credit := total_credit + (entry->>'amount')::NUMERIC;
    END IF;
  END LOOP;

  -- Allow a small floating-point tolerance (0.01)
  IF ABS(total_debit - total_credit) > 0.01 THEN
    RAISE EXCEPTION
      'Journal batch is unbalanced. Debits: %, Credits: %',
      total_debit, total_credit;
  END IF;

  -- Insert all entries
  FOR entry IN SELECT * FROM jsonb_array_elements(entries)
  LOOP
    INSERT INTO public.journals (
      organization_id, journal_type, reference_id, account_id,
      system_account, amount, direction, currency, description, created_by
    ) VALUES (
      (entry->>'organization_id')::UUID,
      entry->>'journal_type',
      (NULLIF(entry->>'reference_id', ''))::UUID,
      (NULLIF(entry->>'account_id', ''))::UUID,
      entry->>'system_account',
      (entry->>'amount')::NUMERIC,
      entry->>'direction',
      COALESCE(NULLIF(entry->>'currency', ''), 'GBP'),
      entry->>'description',
      auth.uid()
    );
  END LOOP;
END;
$$;
