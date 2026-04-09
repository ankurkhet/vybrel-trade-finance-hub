-- ============================================================
-- Fix: Restore Originator Admin visibility
-- 
-- The previous fix (20260409280000) was too aggressive. 
-- It excluded anyone with the 'broker_admin' role from the org-wide SELECT policy.
-- However, an 'originator_admin' might also have the 'broker_admin' role for 
-- testing or operational purposes.
-- 
-- We now allow org-wide access if the user is a broker_admin BUT ALSO an 
-- admin or originator_admin.
-- ============================================================

-- borrowers table
DROP POLICY IF EXISTS "Borrowers viewable by org members" ON public.borrowers;
CREATE POLICY "Borrowers viewable by org members" ON public.borrowers
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = get_org_from_jwt()
      OR user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'originator_admin'::app_role)
    )
    AND (
      NOT has_role(auth.uid(), 'broker_admin'::app_role)
      OR has_role(auth.uid(), 'originator_admin'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- invoices table
DROP POLICY IF EXISTS "Invoices viewable by org members" ON public.invoices;
CREATE POLICY "Invoices viewable by org members" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = get_org_from_jwt()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'originator_admin'::app_role)
    )
    AND (
      NOT has_role(auth.uid(), 'broker_admin'::app_role)
      OR has_role(auth.uid(), 'originator_admin'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- collections table
DROP POLICY IF EXISTS "Collections viewable by org members" ON public.collections;
CREATE POLICY "Collections viewable by org members" ON public.collections
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = get_org_from_jwt()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'originator_admin'::app_role)
    )
    AND (
      NOT has_role(auth.uid(), 'broker_admin'::app_role)
      OR has_role(auth.uid(), 'originator_admin'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- documents table
DROP POLICY IF EXISTS "Documents viewable by org members" ON public.documents;
CREATE POLICY "Documents viewable by org members" ON public.documents
  FOR SELECT TO authenticated
  USING (
    (
      organization_id = get_org_from_jwt()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'originator_admin'::app_role)
    )
    AND (
      NOT has_role(auth.uid(), 'broker_admin'::app_role)
      OR has_role(auth.uid(), 'originator_admin'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );
