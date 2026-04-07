
-- ============================================================
-- BATCH 3: Settlement & Fee Calculation + Batch 5 DB parts
-- ============================================================

-- ---- 3A: Auto-compute final_discounting_rate ----

CREATE OR REPLACE FUNCTION public.auto_compute_facility_rate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.funder_base_rate IS NOT NULL
     AND NEW.funder_margin IS NOT NULL
     AND NEW.originator_margin IS NOT NULL THEN
    NEW.final_discounting_rate := public.compute_facility_rate(
      NEW.funder_base_rate, NEW.funder_margin, NEW.originator_margin
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER auto_compute_facility_rate_trigger
BEFORE INSERT OR UPDATE OF funder_base_rate, funder_margin, originator_margin
ON public.facility_requests
FOR EACH ROW
EXECUTE FUNCTION public.auto_compute_facility_rate();

-- ---- 5C: Dunning escalation stages ----

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dunning_stage') THEN
    CREATE TYPE public.dunning_stage AS ENUM ('none', 'reminder', 'warning', 'escalated', 'legal');
  END IF;
END $$;

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS dunning_stage public.dunning_stage DEFAULT 'none';

-- Update accrue_daily_interest to set dunning stages + notify on first overdue
CREATE OR REPLACE FUNCTION public.accrue_daily_interest()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _inv RECORD;
  _overdue_rate NUMERIC;
  _daily_rate NUMERIC;
  _accrual NUMERIC;
  _days_overdue INTEGER;
  _new_stage dunning_stage;
  _old_stage dunning_stage;
BEGIN
  FOR _inv IN
    SELECT i.id, i.amount, i.due_date, i.accrued_late_fees,
           i.borrower_id, i.organization_id, i.dunning_stage,
           i.last_dunning_date, i.invoice_number,
           fr.overdue_fee_pct,
           b.user_id AS borrower_user_id
    FROM invoices i
    LEFT JOIN disbursement_memos dm ON dm.invoice_id = i.id
    LEFT JOIN facility_requests fr ON fr.id = dm.facility_request_id
    LEFT JOIN borrowers b ON b.id = i.borrower_id
    WHERE i.status IN ('funded', 'partially_settled')
      AND i.due_date < CURRENT_DATE
  LOOP
    _overdue_rate := COALESCE(_inv.overdue_fee_pct, 0);
    _days_overdue := CURRENT_DATE - _inv.due_date;
    _old_stage := COALESCE(_inv.dunning_stage, 'none');

    -- Determine dunning stage
    IF _days_overdue >= 90 THEN
      _new_stage := 'legal';
    ELSIF _days_overdue >= 61 THEN
      _new_stage := 'escalated';
    ELSIF _days_overdue >= 31 THEN
      _new_stage := 'warning';
    ELSIF _days_overdue >= 1 THEN
      _new_stage := 'reminder';
    ELSE
      _new_stage := 'none';
    END IF;

    -- Notify on first overdue day
    IF _inv.last_dunning_date IS NULL AND _days_overdue >= 1 AND _inv.borrower_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (
        _inv.borrower_user_id,
        'Invoice Overdue',
        'Invoice ' || COALESCE(_inv.invoice_number, _inv.id::text) || ' is now overdue. Late fees may apply.',
        'warning',
        '/borrower/invoices'
      );
    END IF;

    -- Skip fee accrual if rate is 0
    IF _overdue_rate <= 0 THEN
      -- Still update dunning stage
      IF _new_stage != _old_stage THEN
        UPDATE invoices SET dunning_stage = _new_stage, updated_at = now() WHERE id = _inv.id;
      END IF;
      CONTINUE;
    END IF;

    _daily_rate := _overdue_rate / 36500.0;
    _accrual := _inv.amount * _daily_rate;

    UPDATE invoices
    SET accrued_late_fees = COALESCE(accrued_late_fees, 0) + _accrual,
        last_dunning_date = CURRENT_DATE,
        dunning_stage = _new_stage,
        updated_at = now()
    WHERE id = _inv.id;

    INSERT INTO audit_logs (action, resource_type, resource_id, details)
    VALUES (
      'late_fee_accrual',
      'invoice',
      _inv.id::text,
      jsonb_build_object(
        'daily_rate_pct', _overdue_rate,
        'accrual_amount', _accrual,
        'invoice_amount', _inv.amount,
        'cumulative_fees', COALESCE(_inv.accrued_late_fees, 0) + _accrual,
        'days_overdue', _days_overdue,
        'dunning_stage', _new_stage::text,
        'borrower_id', _inv.borrower_id
      )
    );
  END LOOP;
END;
$function$;

-- ---- 5A: Notify funder on referral creation ----

CREATE OR REPLACE FUNCTION public.notify_funder_on_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (
    NEW.funder_user_id,
    'New Funding Referral',
    'You have received a new funding referral. Please review and respond.',
    'info',
    '/funder/portfolio'
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER notify_funder_on_referral_trigger
AFTER INSERT ON public.funder_referrals
FOR EACH ROW
EXECUTE FUNCTION public.notify_funder_on_referral();
