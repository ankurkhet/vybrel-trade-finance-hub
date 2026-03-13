
-- Organization settings for credit limits and policies
CREATE TABLE IF NOT EXISTS public.organization_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  default_credit_limit numeric DEFAULT 0,
  max_credit_limit numeric DEFAULT 0,
  required_document_types text[] DEFAULT ARRAY['kyc', 'financial_statement', 'incorporation']::text[],
  auto_approve_below numeric DEFAULT 0,
  review_threshold numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all org settings" ON public.organization_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can view own org settings" ON public.organization_settings
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'originator_admin')
    AND organization_id = public.get_user_organization_id(auth.uid())
  );

-- Allow anon/authenticated to read invitations by token for acceptance flow
CREATE POLICY "Anyone can read invitation by token" ON public.invitations
  FOR SELECT TO anon, authenticated
  USING (accepted_at IS NULL);

-- Trigger for updated_at
CREATE TRIGGER update_organization_settings_updated_at
  BEFORE UPDATE ON public.organization_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
