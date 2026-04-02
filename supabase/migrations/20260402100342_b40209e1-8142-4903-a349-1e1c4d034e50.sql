
-- ============================================================
-- SPRINT 2: FINANCIAL ACCURACY
-- ============================================================

-- 1. Add rate/pricing columns to facility_requests
ALTER TABLE public.facility_requests
  ADD COLUMN IF NOT EXISTS final_discounting_rate NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS advance_rate NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS overdue_fee_pct NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS funder_base_rate NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS funder_margin NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS originator_margin NUMERIC(10,5);

-- 2. Create disbursement_status enum
DO $$ BEGIN
  CREATE TYPE public.disbursement_status AS ENUM (
    'draft', 'pending_approval', 'approved', 'disbursed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Convert disbursement_memos.status from text to enum
-- First add a new column, migrate data, then swap
ALTER TABLE public.disbursement_memos
  ADD COLUMN IF NOT EXISTS status_enum public.disbursement_status;

-- Migrate existing data
UPDATE public.disbursement_memos
SET status_enum = CASE
  WHEN status IN ('draft', 'pending_approval', 'approved', 'disbursed', 'cancelled')
    THEN status::public.disbursement_status
  ELSE 'draft'::public.disbursement_status
END
WHERE status_enum IS NULL;

-- Set default
ALTER TABLE public.disbursement_memos
  ALTER COLUMN status_enum SET DEFAULT 'draft'::public.disbursement_status;

-- 4. Create disbursement transition validation trigger
CREATE OR REPLACE FUNCTION public.validate_disbursement_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _valid BOOLEAN := false;
BEGIN
  -- If status_enum hasn't changed, allow
  IF OLD.status_enum = NEW.status_enum THEN
    RETURN NEW;
  END IF;

  -- Validate transitions
  CASE OLD.status_enum
    WHEN 'draft' THEN
      _valid := NEW.status_enum IN ('pending_approval', 'cancelled');
    WHEN 'pending_approval' THEN
      _valid := NEW.status_enum IN ('approved', 'draft', 'cancelled');
    WHEN 'approved' THEN
      _valid := NEW.status_enum IN ('disbursed', 'cancelled');
    WHEN 'disbursed' THEN
      _valid := false; -- Terminal state
    WHEN 'cancelled' THEN
      _valid := false; -- Terminal state
    ELSE
      _valid := false;
  END CASE;

  IF NOT _valid THEN
    RAISE EXCEPTION 'Invalid disbursement status transition: % → %', OLD.status_enum, NEW.status_enum;
  END IF;

  -- Log the transition to audit_logs
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'status_change',
    'disbursement_memo',
    NEW.id::text,
    jsonb_build_object(
      'from_status', OLD.status_enum::text,
      'to_status', NEW.status_enum::text,
      'memo_number', NEW.memo_number,
      'invoice_id', NEW.invoice_id::text
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_disbursement_transition
  BEFORE UPDATE OF status_enum ON public.disbursement_memos
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_disbursement_transition();

-- 5. Rate cascade function
CREATE OR REPLACE FUNCTION public.compute_facility_rate(
  _funder_base_rate NUMERIC,
  _funder_margin NUMERIC,
  _originator_margin NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(_funder_base_rate, 0)
       + COALESCE(_funder_margin, 0)
       + COALESCE(_originator_margin, 0);
$$;
