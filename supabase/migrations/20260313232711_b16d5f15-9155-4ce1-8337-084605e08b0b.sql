
-- Add onboarding status to organizations
CREATE TYPE public.org_onboarding_status AS ENUM (
  'pending_documents', 'documents_submitted', 'under_review', 'approved', 'rejected'
);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS onboarding_status public.org_onboarding_status NOT NULL DEFAULT 'pending_documents';

-- Organization contacts table
CREATE TABLE public.org_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  designation text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  invited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all org contacts" ON public.org_contacts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can view own org contacts" ON public.org_contacts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Org KYC/KYB documents table
CREATE TABLE public.org_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type text NOT NULL, -- e.g. 'certificate_of_incorporation', 'tax_registration', 'board_resolution', 'kyc_director', 'aml_policy', 'other'
  document_label text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  review_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all org documents" ON public.org_documents
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can view own org documents" ON public.org_documents
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Org admins can upload own org documents" ON public.org_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'originator_admin')
    AND organization_id = public.get_user_organization_id(auth.uid())
  );

-- Triggers
CREATE TRIGGER update_org_contacts_updated_at
  BEFORE UPDATE ON public.org_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_documents_updated_at
  BEFORE UPDATE ON public.org_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for org documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-documents', 'org-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Admins can manage org docs storage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'org-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'org-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can upload to own org folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-documents'
    AND public.has_role(auth.uid(), 'originator_admin')
  );

CREATE POLICY "Org admins can view own org folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-documents'
    AND public.has_role(auth.uid(), 'originator_admin')
  );
