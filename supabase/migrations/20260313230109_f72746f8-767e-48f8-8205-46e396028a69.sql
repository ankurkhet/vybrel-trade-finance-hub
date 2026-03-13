
-- ===========================================
-- PHASE 1 DATABASE SCHEMA
-- ===========================================

-- Enum types
CREATE TYPE public.app_role AS ENUM ('admin', 'originator_admin', 'originator_user', 'borrower', 'funder');
CREATE TYPE public.labelling_mode AS ENUM ('white_label', 'joint_label', 'platform_label');
CREATE TYPE public.onboarding_status AS ENUM ('invited', 'registered', 'documents_pending', 'documents_submitted', 'under_review', 'approved', 'rejected');
CREATE TYPE public.document_type AS ENUM ('kyc', 'financial_statement', 'incorporation', 'contract', 'invoice', 'credit_memo', 'nda', 'other');
CREATE TYPE public.ai_analysis_type AS ENUM ('document_analysis', 'contract_review', 'invoice_contract_match', 'credit_memo');
CREATE TYPE public.ai_analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE public.credit_memo_status AS ENUM ('draft', 'ai_generated', 'under_review', 'approved', 'rejected');

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===========================================
-- ORGANIZATIONS (Originators)
-- ===========================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  labelling_mode labelling_mode NOT NULL DEFAULT 'platform_label',
  branding JSONB DEFAULT '{}',
  custom_domain TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- PROFILES
-- ===========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id),
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- USER ROLES (separate table per security best practices)
-- ===========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get all roles for a user
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS SETOF app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
$$;

-- ===========================================
-- BORROWERS
-- ===========================================
CREATE TABLE public.borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  industry TEXT,
  registration_number TEXT,
  country TEXT,
  onboarding_status onboarding_status NOT NULL DEFAULT 'invited',
  kyc_completed BOOLEAN NOT NULL DEFAULT false,
  aml_cleared BOOLEAN NOT NULL DEFAULT false,
  credit_limit NUMERIC(15,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_borrowers_updated_at
  BEFORE UPDATE ON public.borrowers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- DOCUMENTS
-- ===========================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  borrower_id UUID REFERENCES public.borrowers(id),
  uploaded_by UUID REFERENCES auth.users(id),
  document_type document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- CONTRACTS
-- ===========================================
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  borrower_id UUID REFERENCES public.borrowers(id) NOT NULL,
  document_id UUID REFERENCES public.documents(id),
  contract_number TEXT,
  title TEXT NOT NULL,
  counterparty TEXT,
  contract_value NUMERIC(15,2),
  currency TEXT DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  terms_summary JSONB DEFAULT '{}',
  risk_flags JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- INVOICES
-- ===========================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  borrower_id UUID REFERENCES public.borrowers(id) NOT NULL,
  contract_id UUID REFERENCES public.contracts(id),
  document_id UUID REFERENCES public.documents(id),
  invoice_number TEXT NOT NULL,
  debtor_name TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  match_score NUMERIC(5,2),
  match_details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- AI ANALYSES
-- ===========================================
CREATE TABLE public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  borrower_id UUID REFERENCES public.borrowers(id),
  analysis_type ai_analysis_type NOT NULL,
  status ai_analysis_status NOT NULL DEFAULT 'pending',
  source_document_id UUID REFERENCES public.documents(id),
  source_contract_id UUID REFERENCES public.contracts(id),
  source_invoice_id UUID REFERENCES public.invoices(id),
  findings JSONB DEFAULT '{}',
  risk_score NUMERIC(5,2),
  summary TEXT,
  annotations JSONB DEFAULT '[]',
  requested_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_ai_analyses_updated_at
  BEFORE UPDATE ON public.ai_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- CREDIT MEMOS
-- ===========================================
CREATE TABLE public.credit_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  borrower_id UUID REFERENCES public.borrowers(id) NOT NULL,
  ai_analysis_id UUID REFERENCES public.ai_analyses(id),
  memo_number TEXT,
  status credit_memo_status NOT NULL DEFAULT 'draft',
  borrower_profile JSONB DEFAULT '{}',
  transaction_type TEXT,
  recommended_limit NUMERIC(15,2),
  risk_rating TEXT,
  ai_draft TEXT,
  analyst_edits TEXT,
  final_memo TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_memos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_credit_memos_updated_at
  BEFORE UPDATE ON public.credit_memos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- INVITATIONS
-- ===========================================
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- STORAGE BUCKETS
-- ===========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- ===========================================
-- RLS POLICIES
-- ===========================================

-- Organizations
CREATE POLICY "Admins can manage all orgs" ON public.organizations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can view their org" ON public.organizations
  FOR SELECT TO authenticated
  USING (id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can view org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'originator_admin')
    AND organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Borrowers
CREATE POLICY "Admins can manage all borrowers" ON public.borrowers
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can view org borrowers" ON public.borrowers
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Org admins can manage org borrowers" ON public.borrowers
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'originator_admin')
    AND organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Borrowers can view own record" ON public.borrowers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Documents
CREATE POLICY "Admins can manage all docs" ON public.documents
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can view org docs" ON public.documents
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can upload docs" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- Contracts
CREATE POLICY "Admins can manage all contracts" ON public.contracts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can view org contracts" ON public.contracts
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Invoices
CREATE POLICY "Admins can manage all invoices" ON public.invoices
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can view org invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Borrowers can manage own invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (borrower_id IN (SELECT id FROM public.borrowers WHERE user_id = auth.uid()));

-- AI Analyses
CREATE POLICY "Admins can manage all analyses" ON public.ai_analyses
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can view org analyses" ON public.ai_analyses
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Credit Memos
CREATE POLICY "Admins can manage all memos" ON public.credit_memos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can view org memos" ON public.credit_memos
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Org admins can manage org memos" ON public.credit_memos
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'originator_admin')
    AND organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Invitations
CREATE POLICY "Admins can manage all invitations" ON public.invitations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can manage org invitations" ON public.invitations
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'originator_admin')
    AND organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Storage policies
CREATE POLICY "Authenticated users can upload documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Users can view org documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documents');

CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
