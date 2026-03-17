
-- Credit Committee Members
CREATE TABLE public.credit_committee_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_committee_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all committee members" ON public.credit_committee_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Org admins can manage org committee members" ON public.credit_committee_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'originator_admin') AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Committee members can view own org members" ON public.credit_committee_members FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Credit Committee Config
CREATE TABLE public.credit_committee_config (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_active_members integer NOT NULL DEFAULT 4,
  minimum_votes_required integer NOT NULL DEFAULT 3,
  quorum_type text NOT NULL DEFAULT 'fixed',
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_committee_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all committee config" ON public.credit_committee_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Org admins can manage org committee config" ON public.credit_committee_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'originator_admin') AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Org members can view org committee config" ON public.credit_committee_config FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Credit Committee Applications
CREATE TABLE public.credit_committee_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  borrower_id uuid REFERENCES public.borrowers(id),
  debtor_name text,
  application_number text UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  decision text,
  decision_notes text,
  created_by uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  parent_application_id uuid REFERENCES public.credit_committee_applications(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_committee_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all cc applications" ON public.credit_committee_applications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Org admins can manage org cc applications" ON public.credit_committee_applications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'originator_admin') AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Committee members can view org cc applications" ON public.credit_committee_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'credit_committee_member') AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Committee members can update org cc applications" ON public.credit_committee_applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'credit_committee_member') AND organization_id = public.get_user_organization_id(auth.uid()));
CREATE POLICY "Users can view own cc applications" ON public.credit_committee_applications FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Users can create cc applications" ON public.credit_committee_applications FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- Credit Committee Minutes
CREATE TABLE public.credit_committee_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.credit_committee_applications(id) ON DELETE CASCADE,
  meeting_date timestamp with time zone,
  attendees uuid[] DEFAULT '{}',
  votes jsonb DEFAULT '[]'::jsonb,
  minutes_text text,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_committee_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all cc minutes" ON public.credit_committee_minutes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Org admins can manage org cc minutes" ON public.credit_committee_minutes FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'originator_admin') AND 
  application_id IN (SELECT id FROM public.credit_committee_applications WHERE organization_id = public.get_user_organization_id(auth.uid()))
);
CREATE POLICY "Org members can view org cc minutes" ON public.credit_committee_minutes FOR SELECT TO authenticated USING (
  application_id IN (SELECT id FROM public.credit_committee_applications WHERE organization_id = public.get_user_organization_id(auth.uid()))
);

-- Credit Committee Info Requests
CREATE TABLE public.credit_committee_info_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.credit_committee_applications(id) ON DELETE CASCADE,
  requested_by uuid,
  requested_to uuid,
  question text NOT NULL,
  answer text,
  status text NOT NULL DEFAULT 'open',
  answered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_committee_info_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all cc info requests" ON public.credit_committee_info_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Org admins can manage org cc info requests" ON public.credit_committee_info_requests FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'originator_admin') AND
  application_id IN (SELECT id FROM public.credit_committee_applications WHERE organization_id = public.get_user_organization_id(auth.uid()))
);
CREATE POLICY "Committee members can manage org cc info requests" ON public.credit_committee_info_requests FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'credit_committee_member') AND
  application_id IN (SELECT id FROM public.credit_committee_applications WHERE organization_id = public.get_user_organization_id(auth.uid()))
);
CREATE POLICY "Requestees can view and answer cc info requests" ON public.credit_committee_info_requests FOR ALL TO authenticated USING (requested_to = auth.uid());

-- Triggers
CREATE TRIGGER update_cc_applications_updated_at BEFORE UPDATE ON public.credit_committee_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cc_minutes_updated_at BEFORE UPDATE ON public.credit_committee_minutes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
