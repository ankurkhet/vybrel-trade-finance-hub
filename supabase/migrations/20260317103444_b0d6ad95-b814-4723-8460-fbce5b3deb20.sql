
-- 1. Create counterparties table
CREATE TABLE public.counterparties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_name text,
  contact_email text NOT NULL,
  contact_phone text,
  country text,
  registration_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create borrower_counterparties junction table (many-to-many)
CREATE TABLE public.borrower_counterparties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  counterparty_id uuid NOT NULL REFERENCES public.counterparties(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(borrower_id, counterparty_id)
);

-- 3. Create branding_profiles table for multiple branding configs per org
CREATE TABLE public.branding_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_name text NOT NULL DEFAULT 'Default',
  is_active boolean NOT NULL DEFAULT false,
  logo_url text,
  logo_icon_url text,
  favicon_url text,
  colors jsonb NOT NULL DEFAULT '{}'::jsonb,
  font_family text,
  custom_domain text,
  email_from_name text,
  email_footer_text text,
  login_welcome_text text,
  support_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Enable RLS on all new tables
ALTER TABLE public.counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrower_counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_profiles ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for counterparties
CREATE POLICY "Admins can manage all counterparties" ON public.counterparties FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can manage org counterparties" ON public.counterparties FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Org members can view org counterparties" ON public.counterparties FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Broker admins can view org counterparties" ON public.counterparties FOR SELECT TO authenticated USING (has_role(auth.uid(), 'broker_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));

-- 6. RLS policies for borrower_counterparties
CREATE POLICY "Admins can manage all links" ON public.borrower_counterparties FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can manage org links" ON public.borrower_counterparties FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Org members can view org links" ON public.borrower_counterparties FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));

-- 7. RLS policies for branding_profiles
CREATE POLICY "Admins can manage all branding profiles" ON public.branding_profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can manage own branding profiles" ON public.branding_profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Broker admins can manage own branding profiles" ON public.branding_profiles FOR ALL TO authenticated USING (has_role(auth.uid(), 'broker_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Org members can view org branding" ON public.branding_profiles FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));

-- 8. Create branding-assets storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('branding-assets', 'branding-assets', true);

-- 9. Storage policy for branding assets
CREATE POLICY "Authenticated users can upload branding assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'branding-assets');
CREATE POLICY "Anyone can view branding assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'branding-assets');
CREATE POLICY "Authenticated users can update own branding assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'branding-assets');
CREATE POLICY "Authenticated users can delete own branding assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'branding-assets');

-- 10. Updated_at triggers
CREATE TRIGGER set_updated_at_counterparties BEFORE UPDATE ON public.counterparties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at_branding_profiles BEFORE UPDATE ON public.branding_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
