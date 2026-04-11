-- ============================================================
-- PRD Section 8: validate_disbursement() RPC
-- Called before approving a disbursement to enforce:
--   1. Currency match / interoperability check
--   2. Max invoice amount cap
--   3. Facility overall limit (remaining headroom)
--   4. Counterparty sub-limit (if configured)
-- Returns: { allowed: boolean, reason?: string, available?: number }
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_disbursement(
  p_invoice_id    UUID,
  p_facility_id   UUID,
  p_amount        NUMERIC,
  p_currency      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_facility              RECORD;
  v_invoice               RECORD;
  v_facility_utilised     NUMERIC := 0;
  v_facility_headroom     NUMERIC;
  v_csl                   RECORD;
  v_csl_utilised          NUMERIC := 0;
  v_csl_headroom          NUMERIC;
BEGIN
  -- ── Load facility ─────────────────────────────────────────
  SELECT * INTO v_facility FROM public.facilities WHERE id = p_facility_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Facility not found');
  END IF;

  IF v_facility.status != 'active' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Facility is not active');
  END IF;

  -- Check facility validity dates
  IF v_facility.valid_to IS NOT NULL AND v_facility.valid_to < CURRENT_DATE THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Facility has expired');
  END IF;
  IF v_facility.valid_from IS NOT NULL AND v_facility.valid_from > CURRENT_DATE THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Facility is not yet effective');
  END IF;

  -- ── Load invoice ──────────────────────────────────────────
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Invoice not found');
  END IF;

  -- ── Currency check ────────────────────────────────────────
  IF p_currency != v_facility.currency THEN
    IF NOT COALESCE(v_facility.interoperability_allowed, false) THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Currency mismatch: facility is ' || v_facility.currency
          || ', invoice is ' || p_currency
          || '. Interoperability not enabled for this facility.'
      );
    END IF;

    -- Interoperability: check cross-currency portion doesn't exceed cap
    IF v_facility.interoperability_max_pct IS NOT NULL AND v_facility.interoperability_max_pct > 0 THEN
      DECLARE
        v_invoice_face  NUMERIC;
        v_max_cross     NUMERIC;
      BEGIN
        v_invoice_face := COALESCE(v_invoice.amount, 0);
        v_max_cross := v_invoice_face * (v_facility.interoperability_max_pct / 100.0);
        IF p_amount > v_max_cross THEN
          RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Cross-currency amount exceeds interoperability cap of '
              || v_facility.interoperability_max_pct || '% of invoice face value ('
              || v_max_cross || ' ' || v_facility.currency || ')',
            'available', v_max_cross
          );
        END IF;
      END;
    END IF;
  END IF;

  -- ── Max invoice amount ────────────────────────────────────
  IF v_facility.max_invoice_amount IS NOT NULL
     AND COALESCE(v_invoice.amount, 0) > v_facility.max_invoice_amount THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Invoice face value exceeds facility max invoice amount of '
        || v_facility.max_invoice_amount || ' ' || v_facility.currency,
      'available', v_facility.max_invoice_amount
    );
  END IF;

  -- ── Facility overall utilisation ──────────────────────────
  IF v_facility.overall_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(dm.disbursement_amount), 0)
    INTO v_facility_utilised
    FROM public.disbursement_memos dm
    JOIN public.invoices i ON i.id = dm.invoice_id
    WHERE i.borrower_id = v_facility.borrower_id
      AND dm.status IN ('approved', 'disbursed');

    v_facility_headroom := v_facility.overall_limit - v_facility_utilised;

    IF p_amount > v_facility_headroom THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Disbursement amount exceeds facility headroom. Available: '
          || v_facility_headroom || ' ' || v_facility.currency,
        'available', v_facility_headroom
      );
    END IF;
  END IF;

  -- ── Counterparty sub-limit ────────────────────────────────
  -- invoices.counterparty is TEXT (company name); join via counterparties table
  SELECT csl.* INTO v_csl
  FROM public.counterparty_sub_limits csl
  JOIN public.counterparties cp ON cp.id = csl.counterparty_id
  WHERE csl.facility_id = p_facility_id
    AND cp.company_name = v_invoice.debtor_name
    AND csl.currency = p_currency
    AND csl.status = 'active'
  LIMIT 1;

  IF FOUND THEN
    -- Check per-counterparty max invoice amount if set
    IF v_csl.max_invoice_amount IS NOT NULL
       AND COALESCE(v_invoice.amount, 0) > v_csl.max_invoice_amount THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Invoice exceeds counterparty sub-limit max invoice amount of '
          || v_csl.max_invoice_amount || ' ' || p_currency,
        'available', v_csl.max_invoice_amount
      );
    END IF;

    SELECT COALESCE(SUM(dm.disbursement_amount), 0)
    INTO v_csl_utilised
    FROM public.disbursement_memos dm
    JOIN public.invoices i ON i.id = dm.invoice_id
    JOIN public.counterparties cp2 ON cp2.company_name = i.debtor_name
    WHERE cp2.id = v_csl.counterparty_id
      AND dm.status IN ('approved', 'disbursed');

    v_csl_headroom := v_csl.sub_limit_amount - v_csl_utilised;

    IF p_amount > v_csl_headroom THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Disbursement exceeds counterparty sub-limit headroom. Available: '
          || v_csl_headroom || ' ' || p_currency,
        'available', v_csl_headroom
      );
    END IF;
  END IF;

  -- ── All checks passed ─────────────────────────────────────
  RETURN jsonb_build_object(
    'allowed', true,
    'available', CASE
      WHEN v_facility.overall_limit IS NOT NULL
        THEN v_facility.overall_limit - v_facility_utilised - p_amount
      ELSE NULL
    END
  );
END;
$$;

COMMENT ON FUNCTION public.validate_disbursement IS
  'Pre-approval validation for disbursements. Checks currency, max invoice amount, facility overall limit and counterparty sub-limits. Returns {allowed, reason?, available?}.';

-- Grant execute to authenticated users (called from frontend via RPC)
GRANT EXECUTE ON FUNCTION public.validate_disbursement TO authenticated;
