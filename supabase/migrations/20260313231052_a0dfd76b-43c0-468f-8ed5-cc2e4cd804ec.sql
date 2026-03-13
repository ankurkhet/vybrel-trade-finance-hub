
-- Create security definer function to get user's org_id without hitting RLS
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Drop recursive policies
DROP POLICY IF EXISTS "Org admins can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate without recursion
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can view org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'originator_admin')
    AND organization_id = public.get_user_organization_id(auth.uid())
  );

-- Fix all other policies that reference profiles subquery to use the function instead
-- Organizations
DROP POLICY IF EXISTS "Org members can view their org" ON public.organizations;
CREATE POLICY "Org members can view their org" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_user_organization_id(auth.uid()));

-- Borrowers
DROP POLICY IF EXISTS "Org members can view org borrowers" ON public.borrowers;
CREATE POLICY "Org members can view org borrowers" ON public.borrowers
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "Org admins can manage org borrowers" ON public.borrowers;
CREATE POLICY "Org admins can manage org borrowers" ON public.borrowers
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'originator_admin')
    AND organization_id = public.get_user_organization_id(auth.uid())
  );

-- Documents
DROP POLICY IF EXISTS "Org members can view org docs" ON public.documents;
CREATE POLICY "Org members can view org docs" ON public.documents
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Contracts
DROP POLICY IF EXISTS "Org members can view org contracts" ON public.contracts;
CREATE POLICY "Org members can view org contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Invoices
DROP POLICY IF EXISTS "Org members can view org invoices" ON public.invoices;
CREATE POLICY "Org members can view org invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- AI Analyses
DROP POLICY IF EXISTS "Org members can view org analyses" ON public.ai_analyses;
CREATE POLICY "Org members can view org analyses" ON public.ai_analyses
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Credit Memos
DROP POLICY IF EXISTS "Org members can view org memos" ON public.credit_memos;
CREATE POLICY "Org members can view org memos" ON public.credit_memos
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

DROP POLICY IF EXISTS "Org admins can manage org memos" ON public.credit_memos;
CREATE POLICY "Org admins can manage org memos" ON public.credit_memos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'originator_admin')
    AND organization_id = public.get_user_organization_id(auth.uid())
  );

-- Invitations
DROP POLICY IF EXISTS "Org admins can manage org invitations" ON public.invitations;
CREATE POLICY "Org admins can manage org invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'originator_admin')
    AND organization_id = public.get_user_organization_id(auth.uid())
  );
