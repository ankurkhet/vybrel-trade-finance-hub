
-- Audit hardening
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Nobody can update audit logs' AND tablename = 'audit_logs') THEN
    CREATE POLICY "Nobody can update audit logs" ON public.audit_logs FOR UPDATE TO authenticated USING (false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Nobody can delete audit logs' AND tablename = 'audit_logs') THEN
    CREATE POLICY "Nobody can delete audit logs" ON public.audit_logs FOR DELETE TO authenticated USING (false);
  END IF;
END $$;

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.audit_financial_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id::text,
      jsonb_build_object('new_status', COALESCE(NEW.status, '')));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id::text,
      jsonb_build_object('old_status', COALESCE(OLD.status, ''), 'new_status', COALESCE(NEW.status, '')));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach triggers
DROP TRIGGER IF EXISTS audit_disbursement_memos ON public.disbursement_memos;
DROP TRIGGER IF EXISTS audit_settlement_advices ON public.settlement_advices;
DROP TRIGGER IF EXISTS audit_collections ON public.collections;

CREATE TRIGGER audit_disbursement_memos
  AFTER INSERT OR UPDATE ON public.disbursement_memos
  FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

CREATE TRIGGER audit_settlement_advices
  AFTER INSERT OR UPDATE ON public.settlement_advices
  FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

CREATE TRIGGER audit_collections
  AFTER INSERT OR UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.audit_financial_change();

-- Operations manager RLS policies
CREATE POLICY "Operations managers can view org disbursements"
  ON public.disbursement_memos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operations_manager'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Operations managers can view org collections"
  ON public.collections FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operations_manager'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Operations managers can update org collections"
  ON public.collections FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'operations_manager'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Operations managers can view org settlements"
  ON public.settlement_advices FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operations_manager'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Operations managers can view org repayments"
  ON public.repayment_memos FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operations_manager'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Operations managers can view org invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operations_manager'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
