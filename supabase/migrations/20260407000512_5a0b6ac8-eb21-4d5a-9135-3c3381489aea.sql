
-- ============================================================
-- BATCH 1: Critical Security & Data Integrity Fixes
-- ============================================================

-- ---- 1B: account_manager RLS policies ----

CREATE POLICY "account_manager_select_invoices"
ON public.invoices FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "account_manager_select_borrowers"
ON public.borrowers FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "account_manager_select_documents"
ON public.documents FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "account_manager_select_facility_requests"
ON public.facility_requests FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "account_manager_select_credit_memos"
ON public.credit_memos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "account_manager_select_disbursement_memos"
ON public.disbursement_memos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "account_manager_select_collections"
ON public.collections FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "account_manager_select_settlement_advices"
ON public.settlement_advices FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "account_manager_select_counterparties"
ON public.counterparties FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "account_manager_select_funder_limits"
ON public.funder_limits FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

CREATE POLICY "account_manager_select_cc_applications"
ON public.credit_committee_applications FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'account_manager')
  AND organization_id = public.get_user_organization_id(auth.uid())
);

-- ---- 1C: Fix audit_financial_change() to read status_enum ----

CREATE OR REPLACE FUNCTION public.audit_financial_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id::text,
      jsonb_build_object(
        'new_status', COALESCE(NEW.status_enum::text, NEW.status, '')
      ));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id::text,
      jsonb_build_object(
        'old_status', COALESCE(OLD.status_enum::text, OLD.status, ''),
        'new_status', COALESCE(NEW.status_enum::text, NEW.status, '')
      ));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

-- ---- 1D: Fix accrue_daily_interest() to read numeric column + add audit ----

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
BEGIN
  FOR _inv IN
    SELECT i.id, i.amount, i.due_date, i.accrued_late_fees,
           i.borrower_id, i.organization_id,
           fr.overdue_fee_pct
    FROM invoices i
    LEFT JOIN disbursement_memos dm ON dm.invoice_id = i.id
    LEFT JOIN facility_requests fr ON fr.id = dm.facility_request_id
    WHERE i.status IN ('funded', 'partially_settled')
      AND i.due_date < CURRENT_DATE
  LOOP
    _overdue_rate := COALESCE(_inv.overdue_fee_pct, 0);
    IF _overdue_rate <= 0 THEN
      CONTINUE;
    END IF;

    _daily_rate := _overdue_rate / 36500.0;
    _accrual := _inv.amount * _daily_rate;

    UPDATE invoices
    SET accrued_late_fees = COALESCE(accrued_late_fees, 0) + _accrual,
        last_dunning_date = CURRENT_DATE,
        updated_at = now()
    WHERE id = _inv.id;

    -- Audit the accrual
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
        'borrower_id', _inv.borrower_id
      )
    );
  END LOOP;
END;
$function$;
