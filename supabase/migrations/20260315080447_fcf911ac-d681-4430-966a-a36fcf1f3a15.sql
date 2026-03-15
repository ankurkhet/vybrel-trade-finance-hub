-- Allow counterparties to view invoices addressed to their email
CREATE POLICY "Counterparties can view invoices by email"
ON public.invoices
FOR SELECT
TO authenticated
USING (
  requires_counterparty_acceptance = true
  AND counterparty_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);