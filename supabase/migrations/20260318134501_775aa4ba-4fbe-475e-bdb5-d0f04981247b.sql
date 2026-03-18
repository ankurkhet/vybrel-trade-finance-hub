
-- Add new columns to borrowers table
ALTER TABLE public.borrowers
ADD COLUMN IF NOT EXISTS trading_name text,
ADD COLUMN IF NOT EXISTS incorporation_date date,
ADD COLUMN IF NOT EXISTS registered_address jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS trading_address jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS website text,
ADD COLUMN IF NOT EXISTS vat_tax_id text,
ADD COLUMN IF NOT EXISTS num_employees integer,
ADD COLUMN IF NOT EXISTS annual_turnover numeric,
ADD COLUMN IF NOT EXISTS bank_details jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS phone text;

-- Directors & Authorized Signatories table
CREATE TABLE public.borrower_directors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  date_of_birth date,
  nationality text,
  role text NOT NULL DEFAULT 'director',
  shareholding_pct numeric,
  email text,
  phone text,
  id_document_path text,
  residential_address jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.borrower_directors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all directors" ON public.borrower_directors FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can manage org directors" ON public.borrower_directors FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Credit committee can view org directors" ON public.borrower_directors FOR SELECT TO authenticated USING (has_role(auth.uid(), 'credit_committee_member'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

-- Registry API Configs (admin manages API keys for different country registries)
CREATE TABLE public.registry_api_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  country_name text NOT NULL,
  registry_name text NOT NULL,
  api_base_url text NOT NULL,
  api_key_secret_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  capabilities text[] DEFAULT '{}',
  last_health_check timestamptz,
  health_status text DEFAULT 'unknown',
  health_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registry_api_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage registry configs" ON public.registry_api_configs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can view registry configs" ON public.registry_api_configs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role));

-- Registry Results (fetched data from registries)
CREATE TABLE public.registry_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  registry_api_id uuid REFERENCES public.registry_api_configs(id),
  result_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  match_analysis jsonb DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registry_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all results" ON public.registry_results FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can manage org results" ON public.registry_results FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Credit committee can view org results" ON public.registry_results FOR SELECT TO authenticated USING (has_role(auth.uid(), 'credit_committee_member'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

-- Trigger for updated_at on new tables
CREATE TRIGGER update_borrower_directors_updated_at BEFORE UPDATE ON public.borrower_directors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_registry_api_configs_updated_at BEFORE UPDATE ON public.registry_api_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
