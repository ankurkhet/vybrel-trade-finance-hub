

# Eligibility Check Architecture Hardening

## Current State

The previous fix (lines 234-268 of `InvoiceSubmissionWizard.tsx`) already resolves the correct `funder_user_id` from the `funder_limits` table — it no longer passes the borrower's ID. The critical bug described in the report was already fixed in the April 4 sprint.

However, the current implementation has weaknesses that this plan addresses:
- It picks a random approved funder limit (no tie to the selected facility)
- No DB-level enforcement on `funding_offers`
- No audit logging of eligibility checks
- Error UX could be clearer

---

## Step 1: Tie eligibility check to selected facility (InvoiceSubmissionWizard.tsx)

Currently, the funder lookup at line 236 queries any approved `funder_limits` row for the borrower. It should filter by the selected facility's product type and, if a `selectedFacilityId` is set, prefer funder limits that match.

**Changes to `handleSubmit()` (lines 234-268):**
- If `selectedFacilityId` is set, load the facility to get its `facility_type`
- Query `funder_limits` filtered by the matching product type
- Pass `selectedFacilityId` through to the invoice insert (already done at line 294)
- Show a clear blocking error with the reason when ineligible, preventing submission entirely

## Step 2: DB-level enforcement trigger on funding_offers (Migration)

Create a `BEFORE INSERT` trigger on `funding_offers` that calls `check_funder_eligibility()` and raises an exception if the funder is not eligible.

```sql
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

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_funder_eligibility_on_insert
BEFORE INSERT ON funding_offers
FOR EACH ROW EXECUTE FUNCTION enforce_funder_eligibility_on_insert();
```

## Step 3: Audit logging for eligibility checks (Migration)

Create a helper function that logs eligibility check results to `audit_logs`:

```sql
CREATE OR REPLACE FUNCTION public.log_eligibility_check(
  _user_id uuid, _funder_user_id uuid, _borrower_id uuid,
  _amount numeric, _eligible boolean, _message text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (_user_id, 'eligibility_check', 'funder_limit', _funder_user_id::text,
    jsonb_build_object(
      'borrower_id', _borrower_id, 'amount', _amount,
      'eligible', _eligible, 'message', _message
    ));
END;
$$;
```

Then call this from the frontend after the RPC returns, and also from the DB trigger.

## Step 4: Frontend UX improvements (InvoiceSubmissionWizard.tsx)

- After the eligibility check fails, show an `AlertCircle` banner with the exact reason (e.g. "Invoice amount 50,000 exceeds available limit 30,000")
- Disable the Submit button and show the error inline rather than just a toast
- Add a state variable `eligibilityError` that blocks submission

---

## Summary

| Step | Type | Risk | What it does |
|------|------|------|-------------|
| 1 | Component edit | Low | Ties eligibility to selected facility |
| 2 | Migration | Low | DB trigger prevents invalid funding offers |
| 3 | Migration | Low | Audit trail for all eligibility checks |
| 4 | Component edit | Low | Clear blocking error UX |

**Files modified:** 1 migration (Steps 2-3), 1 component (Steps 1, 4)

