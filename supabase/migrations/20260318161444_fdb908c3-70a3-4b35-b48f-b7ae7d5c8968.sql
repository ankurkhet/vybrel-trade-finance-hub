
-- Invoice submissions tracking table
CREATE TABLE public.invoice_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  borrower_id uuid NOT NULL REFERENCES public.borrowers(id),
  invoice_id uuid REFERENCES public.invoices(id),
  status text NOT NULL DEFAULT 'draft',
  ai_analysis jsonb DEFAULT '{}'::jsonb,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  observations jsonb DEFAULT '[]'::jsonb,
  borrower_comments jsonb DEFAULT '{}'::jsonb,
  document_comments jsonb DEFAULT '{}'::jsonb,
  overall_comment text,
  funding_id text,
  submitted_at timestamptz,
  submitted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Submission documents junction
CREATE TABLE public.invoice_submission_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.invoice_submissions(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id),
  ai_tag text,
  ai_confidence numeric,
  ai_extracted jsonb DEFAULT '{}'::jsonb,
  borrower_comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_submission_documents ENABLE ROW LEVEL SECURITY;

-- RLS for invoice_submissions
CREATE POLICY "Admins can manage all submissions" ON public.invoice_submissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can manage org submissions" ON public.invoice_submissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Org members can view org submissions" ON public.invoice_submissions FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Borrowers can manage own submissions" ON public.invoice_submissions FOR ALL TO authenticated USING (borrower_id IN (SELECT id FROM public.borrowers WHERE user_id = auth.uid()));

-- RLS for invoice_submission_documents
CREATE POLICY "Admins can manage all submission docs" ON public.invoice_submission_documents FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Submission owners can manage docs" ON public.invoice_submission_documents FOR ALL TO authenticated USING (submission_id IN (SELECT id FROM public.invoice_submissions WHERE borrower_id IN (SELECT id FROM public.borrowers WHERE user_id = auth.uid())));
CREATE POLICY "Org members can view submission docs" ON public.invoice_submission_documents FOR SELECT TO authenticated USING (submission_id IN (SELECT id FROM public.invoice_submissions WHERE organization_id = get_user_organization_id(auth.uid())));

-- Sequence for request numbers
CREATE SEQUENCE public.invoice_submission_seq START 1000;

-- Function to generate request number
CREATE OR REPLACE FUNCTION public.generate_submission_request_number()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
    NEW.request_number := 'REQ-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.invoice_submission_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_submission_request_number
  BEFORE INSERT ON public.invoice_submissions
  FOR EACH ROW EXECUTE FUNCTION public.generate_submission_request_number();

-- Updated_at trigger
CREATE TRIGGER update_invoice_submissions_updated_at
  BEFORE UPDATE ON public.invoice_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
