
-- ============================================================
-- SPRINT 4: ENHANCEMENTS
-- ============================================================

-- 1. Broker fee modelling
ALTER TABLE public.product_fee_configs
  ADD COLUMN IF NOT EXISTS broker_fee_pct NUMERIC(10,5) DEFAULT 0;

-- 2. Funder limit validation function
CREATE OR REPLACE FUNCTION public.check_funder_eligibility(
  _funder_user_id UUID,
  _borrower_id UUID,
  _organization_id UUID,
  _invoice_amount NUMERIC,
  _product_type TEXT DEFAULT 'receivables_purchase'
)
RETURNS TABLE(eligible BOOLEAN, available_limit NUMERIC, message TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit_record RECORD;
  _used_amount NUMERIC;
  _product_limit NUMERIC;
  _available NUMERIC;
BEGIN
  -- Find the funder limit for this borrower
  SELECT * INTO _limit_record
  FROM funder_limits
  WHERE funder_user_id = _funder_user_id
    AND borrower_id = _borrower_id
    AND organization_id = _organization_id
    AND status = 'active'
  LIMIT 1;

  IF _limit_record IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'No active funder limit found for this borrower'::TEXT;
    RETURN;
  END IF;

  -- Calculate outstanding exposure
  SELECT COALESCE(SUM(fo.offer_amount), 0) INTO _used_amount
  FROM funding_offers fo
  JOIN invoices i ON i.id = fo.invoice_id
  WHERE fo.funder_user_id = _funder_user_id
    AND i.borrower_id = _borrower_id
    AND fo.status IN ('pending', 'accepted')
    AND i.status NOT IN ('collected', 'cancelled');

  -- Check product-specific limit
  _product_limit := CASE _product_type
    WHEN 'receivables_purchase' THEN COALESCE(_limit_record.limit_receivables_purchase, _limit_record.limit_amount)
    WHEN 'reverse_factoring' THEN COALESCE(_limit_record.limit_reverse_factoring, _limit_record.limit_amount)
    WHEN 'payables_finance' THEN COALESCE(_limit_record.limit_payable_finance, _limit_record.limit_amount)
    ELSE _limit_record.limit_amount
  END;

  _available := _product_limit - _used_amount;

  IF _invoice_amount > _available THEN
    RETURN QUERY SELECT false, _available, format('Invoice amount %s exceeds available limit %s', _invoice_amount, _available)::TEXT;
  ELSE
    RETURN QUERY SELECT true, _available, 'Eligible'::TEXT;
  END IF;
  RETURN;
END;
$$;

-- 3. Borrower exposure calculation function
CREATE OR REPLACE FUNCTION public.get_borrower_exposure(
  _borrower_id UUID,
  _organization_id UUID
)
RETURNS TABLE(total_funded NUMERIC, total_invoices BIGINT, total_collected NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN i.status IN ('funded', 'partially_settled') THEN i.amount ELSE 0 END), 0) AS total_funded,
    COUNT(CASE WHEN i.status IN ('funded', 'partially_settled') THEN 1 END) AS total_invoices,
    COALESCE(SUM(CASE WHEN i.status = 'collected' THEN i.amount ELSE 0 END), 0) AS total_collected
  FROM invoices i
  WHERE i.borrower_id = _borrower_id
    AND i.organization_id = _organization_id;
$$;
