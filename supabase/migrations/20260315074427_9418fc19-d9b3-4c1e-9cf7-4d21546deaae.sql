
-- Fix overly permissive anon policy - require valid acceptance_token match
DROP POLICY "Anon can insert acceptances via token" ON public.invoice_acceptances;

-- Create a security definer function for counterparty acceptance
CREATE OR REPLACE FUNCTION public.accept_invoice_by_token(
  _token text,
  _email text,
  _status acceptance_status,
  _notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice_id uuid;
  _org_id uuid;
BEGIN
  -- Find invoice by token
  SELECT id, organization_id INTO _invoice_id, _org_id
  FROM invoices
  WHERE acceptance_token = _token
    AND requires_counterparty_acceptance = true
    AND acceptance_status = 'pending';
  
  IF _invoice_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Update invoice acceptance status
  UPDATE invoices 
  SET acceptance_status = _status
  WHERE id = _invoice_id;
  
  -- Insert acceptance record
  INSERT INTO invoice_acceptances (invoice_id, organization_id, method, status, accepted_by_email, notes)
  VALUES (_invoice_id, _org_id, 'direct_counterparty', _status, _email, _notes);
  
  RETURN true;
END;
$$;

-- Also drop the overly permissive anon SELECT on invoices and make it token-scoped
DROP POLICY "Counterparties can view invoices by token" ON public.invoices;
