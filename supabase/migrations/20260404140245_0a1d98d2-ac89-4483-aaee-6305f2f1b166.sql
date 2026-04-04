
-- Step 1: Add facility_request_id to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS facility_request_id UUID REFERENCES public.facility_requests(id);

-- Step 2: Add maker-checker fields to funder_limits
ALTER TABLE public.funder_limits
ADD COLUMN IF NOT EXISTS approved_by UUID,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Update the funder_limit status transition trigger to auto-populate approved_by/approved_at
CREATE OR REPLACE FUNCTION public.validate_funder_limit_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _valid BOOLEAN := false;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  CASE OLD.status
    WHEN 'pending' THEN _valid := NEW.status IN ('approved', 'rejected', 'suspended');
    WHEN 'approved' THEN _valid := NEW.status IN ('suspended');
    WHEN 'rejected' THEN _valid := false;
    WHEN 'suspended' THEN _valid := NEW.status IN ('approved');
    ELSE _valid := false;
  END CASE;

  IF NOT _valid THEN
    RAISE EXCEPTION 'Invalid funder limit status transition: % → %', OLD.status, NEW.status;
  END IF;

  -- Auto-populate maker-checker fields on approval
  IF NEW.status = 'approved' THEN
    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  END IF;

  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'status_change', 'funder_limit', NEW.id::text,
    jsonb_build_object('from', OLD.status, 'to', NEW.status));

  RETURN NEW;
END;
$$;

-- Step 4: Add audit triggers on funding_offers and funder_referrals
CREATE TRIGGER audit_funding_offers_change
AFTER INSERT OR UPDATE ON public.funding_offers
FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

CREATE TRIGGER audit_funder_referrals_change
AFTER INSERT OR UPDATE ON public.funder_referrals
FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

-- Step 5: Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Authenticated can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read) WHERE NOT is_read;

-- Step 6: Expiry automation function
CREATE OR REPLACE FUNCTION public.expire_stale_recommendations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count INTEGER;
BEGIN
  UPDATE credit_limit_recommendations
  SET status = 'expired', updated_at = now()
  WHERE valid_to < CURRENT_DATE
    AND status = 'approved';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
