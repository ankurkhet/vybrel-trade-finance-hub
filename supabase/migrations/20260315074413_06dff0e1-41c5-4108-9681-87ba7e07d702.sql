
-- Product type enum
CREATE TYPE public.product_type AS ENUM (
  'receivables_purchase',
  'reverse_factoring', 
  'payables_finance'
);

-- Acceptance method enum
CREATE TYPE public.acceptance_method AS ENUM (
  'direct_counterparty',
  'document_upload'
);

-- Acceptance status enum
CREATE TYPE public.acceptance_status AS ENUM (
  'pending',
  'accepted',
  'rejected',
  'accepted_via_document'
);

-- Add product_type and acceptance columns to invoices
ALTER TABLE public.invoices 
  ADD COLUMN product_type public.product_type DEFAULT 'receivables_purchase',
  ADD COLUMN requires_counterparty_acceptance boolean DEFAULT false,
  ADD COLUMN counterparty_email text,
  ADD COLUMN counterparty_name text,
  ADD COLUMN acceptance_status public.acceptance_status DEFAULT 'pending',
  ADD COLUMN acceptance_token text DEFAULT encode(extensions.gen_random_bytes(32), 'hex');

-- Invoice acceptance records table
CREATE TABLE public.invoice_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  method public.acceptance_method NOT NULL,
  status public.acceptance_status NOT NULL DEFAULT 'pending',
  accepted_by_user_id uuid,
  accepted_by_email text,
  notes text,
  document_id uuid REFERENCES public.documents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_acceptances ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_acceptances
CREATE POLICY "Admins can manage all acceptances"
  ON public.invoice_acceptances FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Org members can view org acceptances"
  ON public.invoice_acceptances FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Org admins can manage org acceptances"
  ON public.invoice_acceptances FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Borrowers can insert acceptances for their invoices"
  ON public.invoice_acceptances FOR INSERT TO authenticated
  WITH CHECK (
    invoice_id IN (
      SELECT i.id FROM invoices i 
      JOIN borrowers b ON b.id = i.borrower_id 
      WHERE b.user_id = auth.uid()
    )
  );

CREATE POLICY "Borrowers can view acceptances for their invoices"
  ON public.invoice_acceptances FOR SELECT TO authenticated
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i 
      JOIN borrowers b ON b.id = i.borrower_id 
      WHERE b.user_id = auth.uid()
    )
  );

-- Allow counterparties (anon) to view invoices by acceptance token
CREATE POLICY "Counterparties can view invoices by token"
  ON public.invoices FOR SELECT TO anon
  USING (acceptance_token IS NOT NULL AND requires_counterparty_acceptance = true);

-- Allow counterparties (anon) to insert acceptances
CREATE POLICY "Anon can insert acceptances via token"
  ON public.invoice_acceptances FOR INSERT TO anon
  WITH CHECK (true);

-- Updated at trigger for invoice_acceptances
CREATE TRIGGER set_updated_at_invoice_acceptances
  BEFORE UPDATE ON public.invoice_acceptances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for acceptances
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_acceptances;
