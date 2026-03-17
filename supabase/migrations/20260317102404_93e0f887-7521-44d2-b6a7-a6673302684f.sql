
-- RLS: Broker admins can view borrowers linked to them
CREATE POLICY "Broker admins can view linked borrowers"
  ON public.borrowers FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'broker_admin'::app_role) 
    AND broker_user_id = auth.uid()
  );

-- RLS: Broker admins can view linked contracts
CREATE POLICY "Broker admins can view linked contracts"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'broker_admin'::app_role)
    AND borrower_id IN (
      SELECT id FROM public.borrowers WHERE broker_user_id = auth.uid()
    )
  );

-- RLS: Broker admins can view linked invoices
CREATE POLICY "Broker admins can view linked invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'broker_admin'::app_role)
    AND borrower_id IN (
      SELECT id FROM public.borrowers WHERE broker_user_id = auth.uid()
    )
  );

-- RLS: Broker admins can view linked collections
CREATE POLICY "Broker admins can view linked collections"
  ON public.collections FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'broker_admin'::app_role)
    AND organization_id = get_user_organization_id(auth.uid())
  );

-- RLS: Broker admins can view fee configs (read-only)
CREATE POLICY "Broker admins can view fee configs"
  ON public.product_fee_configs FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'broker_admin'::app_role)
    AND organization_id = get_user_organization_id(auth.uid())
  );

-- RLS: Broker admins can view linked documents
CREATE POLICY "Broker admins can view linked documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'broker_admin'::app_role)
    AND borrower_id IN (
      SELECT id FROM public.borrowers WHERE broker_user_id = auth.uid()
    )
  );

-- RLS: Broker admins can view linked settlement advices
CREATE POLICY "Broker admins can view linked settlement advices"
  ON public.settlement_advices FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'broker_admin'::app_role)
    AND to_borrower_id IN (
      SELECT id FROM public.borrowers WHERE broker_user_id = auth.uid()
    )
  );

-- RLS: Broker admins can view own org
CREATE POLICY "Broker admins can view own org"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'broker_admin'::app_role)
    AND id = get_user_organization_id(auth.uid())
  );
