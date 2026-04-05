-- Step 2: DB-level enforcement trigger on funding_offers
CREATE OR REPLACE FUNCTION public.enforce_funder_eligibility_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _inv RECORD;
  _result RECORD;
BEGIN
  SELECT borrower_id, organization_id, amount, product_type
  INTO _inv FROM invoices WHERE id = NEW.invoice_id;

  IF _inv IS NULL THEN
    RAISE EXCEPTION 'Invoice not found: %', NEW.invoice_id;
  END IF;

  SELECT * INTO _result FROM check_funder_eligibility(
    NEW.funder_user_id, _inv.borrower_id, _inv.organization_id,
    NEW.offer_amount, COALESCE(_inv.product_type, 'receivables_purchase')
  );

  IF _result IS NOT NULL AND _result.eligible = false THEN
    RAISE EXCEPTION 'Funder not eligible: %', _result.message;
  END IF;

  -- Log the eligibility check
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'eligibility_check',
    'funding_offer',
    NEW.invoice_id::text,
    jsonb_build_object(
      'funder_user_id', NEW.funder_user_id,
      'borrower_id', _inv.borrower_id,
      'offer_amount', NEW.offer_amount,
      'eligible', COALESCE(_result.eligible, true),
      'message', COALESCE(_result.message, 'No limit found, allowed')
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_funder_eligibility_on_insert
BEFORE INSERT ON funding_offers
FOR EACH ROW EXECUTE FUNCTION public.enforce_funder_eligibility_on_insert();

-- Step 3: Audit logging helper for eligibility checks (called from frontend)
CREATE OR REPLACE FUNCTION public.log_eligibility_check(
  _user_id uuid,
  _funder_user_id uuid,
  _borrower_id uuid,
  _amount numeric,
  _eligible boolean,
  _message text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    _user_id,
    'eligibility_check',
    'funder_limit',
    _funder_user_id::text,
    jsonb_build_object(
      'borrower_id', _borrower_id,
      'amount', _amount,
      'eligible', _eligible,
      'message', _message
    )
  );
END;
$$;