
-- 1. funder_relationships: MSA between funder and originator
CREATE TABLE public.funder_relationships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  funder_user_id uuid NOT NULL,
  agreement_status text NOT NULL DEFAULT 'pending',
  master_base_rate_type text DEFAULT 'Fixed Rate',
  master_base_rate_value numeric DEFAULT 0,
  master_margin_pct numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.funder_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all funder_relationships" ON public.funder_relationships FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Org admins can manage org funder_relationships" ON public.funder_relationships FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin') AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Funders can view own relationships" ON public.funder_relationships FOR SELECT TO authenticated USING (funder_user_id = auth.uid());

-- 2. funder_limits: credit limit referrals
CREATE TABLE public.funder_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  borrower_id uuid NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  funder_user_id uuid NOT NULL,
  counterparty_name text,
  limit_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  base_rate_type text DEFAULT 'Fixed Rate',
  base_rate_value numeric DEFAULT 0,
  margin_pct numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.funder_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all funder_limits" ON public.funder_limits FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Org admins can manage org funder_limits" ON public.funder_limits FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin') AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Funders can view own limits" ON public.funder_limits FOR SELECT TO authenticated USING (funder_user_id = auth.uid());
CREATE POLICY "Funders can update own limits" ON public.funder_limits FOR UPDATE TO authenticated USING (funder_user_id = auth.uid());

-- 3. funder_kyc: funder onboarding KYC data
CREATE TABLE public.funder_kyc (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid,
  status text NOT NULL DEFAULT 'draft',
  entity_name text NOT NULL DEFAULT '',
  entity_type text NOT NULL DEFAULT '',
  registration_number text DEFAULT '',
  country_of_incorporation text DEFAULT 'United Kingdom',
  registered_address text DEFAULT '',
  regulatory_status text DEFAULT '',
  regulator_name text DEFAULT '',
  licence_number text DEFAULT '',
  contact_name text DEFAULT '',
  contact_email text DEFAULT '',
  contact_phone text DEFAULT '',
  bank_name text DEFAULT '',
  bank_account_name text DEFAULT '',
  bank_account_number text DEFAULT '',
  bank_sort_code text DEFAULT '',
  bank_iban text DEFAULT '',
  bank_swift text DEFAULT '',
  aml_policy_confirmed boolean DEFAULT false,
  pep_screening_confirmed boolean DEFAULT false,
  sanctions_screening_confirmed boolean DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.funder_kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all funder_kyc" ON public.funder_kyc FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Funders can manage own kyc" ON public.funder_kyc FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Org admins can view org funder_kyc" ON public.funder_kyc FOR SELECT TO authenticated USING (has_role(auth.uid(), 'originator_admin') AND organization_id = get_user_organization_id(auth.uid()));
