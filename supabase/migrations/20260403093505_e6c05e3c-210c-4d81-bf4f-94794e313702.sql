
-- ============================================================
-- STEP 1: CC Application Hardening
-- ============================================================

-- 1a. Create application_type enum
DO $$ BEGIN
  CREATE TYPE public.application_type AS ENUM (
    'new_facility', 'limit_increase', 'limit_renewal', 'counterparty_limit', 'facility_addition'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1b. Add credit_memo_id FK
ALTER TABLE public.credit_committee_applications
  ADD COLUMN IF NOT EXISTS credit_memo_id UUID REFERENCES public.credit_memos(id);

-- 1c. Convert type column: add new column, migrate data, swap
ALTER TABLE public.credit_committee_applications
  ADD COLUMN IF NOT EXISTS type_enum public.application_type;

UPDATE public.credit_committee_applications SET type_enum = 
  CASE 
    WHEN type ILIKE '%increase%' THEN 'limit_increase'::public.application_type
    WHEN type ILIKE '%renewal%' THEN 'limit_renewal'::public.application_type
    WHEN type ILIKE '%counterparty%' THEN 'counterparty_limit'::public.application_type
    WHEN type ILIKE '%addition%' THEN 'facility_addition'::public.application_type
    ELSE 'new_facility'::public.application_type
  END
WHERE type_enum IS NULL;

-- 1d. Status transition trigger
CREATE OR REPLACE FUNCTION public.validate_cc_application_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _valid BOOLEAN := false;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  CASE OLD.status
    WHEN 'draft' THEN _valid := NEW.status IN ('submitted');
    WHEN 'submitted' THEN _valid := NEW.status IN ('under_review', 'draft');
    WHEN 'under_review' THEN _valid := NEW.status IN ('approved', 'rejected', 'deferred');
    WHEN 'approved' THEN _valid := false;
    WHEN 'rejected' THEN _valid := false;
    WHEN 'deferred' THEN _valid := NEW.status IN ('submitted', 'draft');
    ELSE _valid := false;
  END CASE;

  IF NOT _valid THEN
    RAISE EXCEPTION 'Invalid CC application status transition: % → %', OLD.status, NEW.status;
  END IF;

  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'status_change', 'credit_committee_application', NEW.id::text,
    jsonb_build_object('from', OLD.status, 'to', NEW.status));

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_cc_application_status ON public.credit_committee_applications;
CREATE TRIGGER trg_cc_application_status
  BEFORE UPDATE ON public.credit_committee_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cc_application_status_transition();

-- 1e. Parent-state validation trigger
CREATE OR REPLACE FUNCTION public.validate_cc_parent_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _parent_status TEXT;
BEGIN
  IF NEW.parent_application_id IS NULL THEN RETURN NEW; END IF;

  SELECT status INTO _parent_status
  FROM credit_committee_applications
  WHERE id = NEW.parent_application_id;

  IF _parent_status IS NULL THEN
    RAISE EXCEPTION 'Parent application not found';
  END IF;

  IF _parent_status != 'approved' THEN
    RAISE EXCEPTION 'Parent application must be approved (current: %)', _parent_status;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_cc_parent_validation ON public.credit_committee_applications;
CREATE TRIGGER trg_cc_parent_validation
  BEFORE INSERT ON public.credit_committee_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_cc_parent_state();

-- ============================================================
-- STEP 2: Structured Voting Table
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.cc_vote_type AS ENUM ('approve', 'reject', 'abstain', 'approve_with_conditions');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.credit_committee_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.credit_committee_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote public.cc_vote_type NOT NULL,
  conditions_text TEXT,
  product_limits JSONB DEFAULT '{}'::jsonb,
  voted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(application_id, user_id)
);

ALTER TABLE public.credit_committee_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all cc votes"
  ON public.credit_committee_votes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins can manage org cc votes"
  ON public.credit_committee_votes FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    AND application_id IN (
      SELECT id FROM credit_committee_applications
      WHERE organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "CC members can insert own votes"
  ON public.credit_committee_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND application_id IN (
      SELECT id FROM credit_committee_applications
      WHERE organization_id = get_user_organization_id(auth.uid())
    )
  );

CREATE POLICY "Org members can view org cc votes"
  ON public.credit_committee_votes FOR SELECT TO authenticated
  USING (
    application_id IN (
      SELECT id FROM credit_committee_applications
      WHERE organization_id = get_user_organization_id(auth.uid())
    )
  );

-- ============================================================
-- STEP 3: Limit Recommendations + Funder Referrals
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.recommendation_status AS ENUM ('draft', 'active', 'expired', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.referral_status AS ENUM ('referred', 'under_review', 'approved', 'rejected', 'counter_offered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.credit_limit_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.credit_committee_applications(id),
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id),
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  recommended_overall_limit NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  limit_receivables_purchase NUMERIC DEFAULT 0,
  limit_reverse_factoring NUMERIC DEFAULT 0,
  limit_payables_finance NUMERIC DEFAULT 0,
  counterparty_limits JSONB DEFAULT '[]'::jsonb,
  risk_grade TEXT,
  recommended_rate NUMERIC,
  valid_from DATE,
  valid_to DATE,
  status public.recommendation_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_limit_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all recommendations"
  ON public.credit_limit_recommendations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins can manage org recommendations"
  ON public.credit_limit_recommendations FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    AND organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "Org members can view org recommendations"
  ON public.credit_limit_recommendations FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE TABLE IF NOT EXISTS public.funder_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES public.credit_limit_recommendations(id),
  funder_user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  referred_limit_amount NUMERIC NOT NULL DEFAULT 0,
  referred_limit_rp NUMERIC DEFAULT 0,
  referred_limit_rf NUMERIC DEFAULT 0,
  referred_limit_pf NUMERIC DEFAULT 0,
  referred_rate NUMERIC,
  counterparty_scope TEXT DEFAULT 'all',
  status public.referral_status NOT NULL DEFAULT 'referred',
  funder_approved_amount NUMERIC,
  funder_notes TEXT,
  referred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.funder_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all referrals"
  ON public.funder_referrals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org admins can manage org referrals"
  ON public.funder_referrals FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    AND organization_id = get_user_organization_id(auth.uid())
  );

CREATE POLICY "Funders can view own referrals"
  ON public.funder_referrals FOR SELECT TO authenticated
  USING (funder_user_id = auth.uid());

CREATE POLICY "Funders can update own referrals"
  ON public.funder_referrals FOR UPDATE TO authenticated
  USING (funder_user_id = auth.uid());

-- Add referral_id, valid_from, valid_to, counter-offer fields to funder_limits
ALTER TABLE public.funder_limits
  ADD COLUMN IF NOT EXISTS referral_id UUID REFERENCES public.funder_referrals(id),
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE,
  ADD COLUMN IF NOT EXISTS funder_approved_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- ============================================================
-- STEP 4: Funder Limit Status Transition Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_funder_limit_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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

  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'status_change', 'funder_limit', NEW.id::text,
    jsonb_build_object('from', OLD.status, 'to', NEW.status));

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_funder_limit_status ON public.funder_limits;
CREATE TRIGGER trg_funder_limit_status
  BEFORE UPDATE ON public.funder_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_funder_limit_status_transition();

-- ============================================================
-- STEP 5: Fix check_funder_eligibility
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_funder_eligibility(
  _funder_user_id UUID,
  _borrower_id UUID,
  _organization_id UUID,
  _invoice_amount NUMERIC,
  _product_type TEXT DEFAULT 'receivables_purchase',
  _counterparty_id UUID DEFAULT NULL
)
RETURNS TABLE(eligible BOOLEAN, available_limit NUMERIC, message TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _limit_record RECORD;
  _used_amount NUMERIC;
  _product_limit NUMERIC;
  _available NUMERIC;
  _cp_limit RECORD;
  _cp_used NUMERIC;
BEGIN
  -- Find the funder limit — fix: status = 'approved' not 'active'
  SELECT * INTO _limit_record
  FROM funder_limits
  WHERE funder_user_id = _funder_user_id
    AND borrower_id = _borrower_id
    AND organization_id = _organization_id
    AND status = 'approved'
    AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
    AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
  LIMIT 1;

  IF _limit_record IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'No approved funder limit found for this borrower'::TEXT;
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
    RETURN;
  END IF;

  -- Counterparty-level sub-limit check
  IF _counterparty_id IS NOT NULL THEN
    SELECT * INTO _cp_limit
    FROM funder_limits
    WHERE funder_user_id = _funder_user_id
      AND borrower_id = _borrower_id
      AND counterparty_id = _counterparty_id
      AND organization_id = _organization_id
      AND status = 'approved'
      AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
      AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
    LIMIT 1;

    IF _cp_limit IS NOT NULL THEN
      SELECT COALESCE(SUM(fo.offer_amount), 0) INTO _cp_used
      FROM funding_offers fo
      JOIN invoices i ON i.id = fo.invoice_id
      WHERE fo.funder_user_id = _funder_user_id
        AND i.borrower_id = _borrower_id
        AND fo.status IN ('pending', 'accepted')
        AND i.status NOT IN ('collected', 'cancelled')
        AND (i.debtor_name IN (SELECT company_name FROM counterparties WHERE id = _counterparty_id));

      IF _invoice_amount > (_cp_limit.limit_amount - _cp_used) THEN
        RETURN QUERY SELECT false, (_cp_limit.limit_amount - _cp_used), 
          format('Invoice exceeds counterparty sub-limit: available %s', (_cp_limit.limit_amount - _cp_used))::TEXT;
        RETURN;
      END IF;
    END IF;
  END IF;

  RETURN QUERY SELECT true, _available, 'Eligible'::TEXT;
  RETURN;
END;
$fn$;

-- Updated_at triggers for new tables
CREATE TRIGGER update_credit_limit_recommendations_updated_at
  BEFORE UPDATE ON public.credit_limit_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funder_referrals_updated_at
  BEFORE UPDATE ON public.funder_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
