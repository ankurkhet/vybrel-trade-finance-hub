-- Allow admins to manage (including delete) org contacts
CREATE POLICY "Admins can delete org contacts"
ON public.org_contacts
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update org contacts
CREATE POLICY "Admins can update org contacts"
ON public.org_contacts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert org contacts
CREATE POLICY "Admins can insert org contacts"
ON public.org_contacts
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
