-- Allow originator admins to update invoices in their org
CREATE POLICY "Org admins can manage org invoices"
ON public.invoices FOR ALL TO authenticated
USING (has_role(auth.uid(), 'originator_admin') AND organization_id = get_user_organization_id(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'originator_admin') AND organization_id = get_user_organization_id(auth.uid()));

-- Also allow funders to view approved invoices for the marketplace
CREATE POLICY "Funders can view approved invoices"
ON public.invoices FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'funder') AND status = 'approved');