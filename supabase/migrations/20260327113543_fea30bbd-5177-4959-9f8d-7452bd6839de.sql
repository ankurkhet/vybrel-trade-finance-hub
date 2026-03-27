
-- Facility requests table for multiple facility types per borrower
CREATE TABLE public.facility_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  facility_type text NOT NULL,
  amount_requested numeric,
  currency text NOT NULL DEFAULT 'GBP',
  tenor_months integer,
  pricing_notes text,
  status text NOT NULL DEFAULT 'requested',
  approved_amount numeric,
  approved_tenor_months integer,
  approved_at timestamp with time zone,
  approved_by uuid,
  rejection_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.facility_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all facility requests" ON public.facility_requests FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can manage org facility requests" ON public.facility_requests FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Borrowers can manage own facility requests" ON public.facility_requests FOR ALL TO authenticated USING (borrower_id IN (SELECT id FROM borrowers WHERE user_id = auth.uid()));
CREATE POLICY "Org members can view org facility requests" ON public.facility_requests FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));

-- Current lenders/bankers table
CREATE TABLE public.borrower_lenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id uuid NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lender_name text NOT NULL,
  facility_nature text,
  facility_amount numeric,
  currency text NOT NULL DEFAULT 'GBP',
  is_secured boolean DEFAULT false,
  repayment_schedule text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.borrower_lenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all borrower lenders" ON public.borrower_lenders FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can manage org borrower lenders" ON public.borrower_lenders FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Borrowers can manage own lenders" ON public.borrower_lenders FOR ALL TO authenticated USING (borrower_id IN (SELECT id FROM borrowers WHERE user_id = auth.uid()));
CREATE POLICY "Org members can view org borrower lenders" ON public.borrower_lenders FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));

-- Add new fields to borrowers table
ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS is_part_of_group boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_company_name text,
  ADD COLUMN IF NOT EXISTS parent_shareholding_pct numeric,
  ADD COLUMN IF NOT EXISTS sic_codes text[],
  ADD COLUMN IF NOT EXISTS nda_signed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nda_signed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS nda_document_id uuid,
  ADD COLUMN IF NOT EXISTS signatory_is_director boolean,
  ADD COLUMN IF NOT EXISTS signatory_name text,
  ADD COLUMN IF NOT EXISTS signatory_email text,
  ADD COLUMN IF NOT EXISTS signatory_designation text,
  ADD COLUMN IF NOT EXISTS signatory_dob text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS has_credit_facilities boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS other_invoice_facilities text,
  ADD COLUMN IF NOT EXISTS kyb_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS funding_status text DEFAULT 'none';

-- Disbursement memos table
CREATE TABLE public.disbursement_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  borrower_id uuid NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  facility_request_id uuid REFERENCES public.facility_requests(id),
  funder_name text,
  counterparty_name text,
  invoice_number text,
  invoice_date date,
  invoice_due_date date,
  invoice_value numeric NOT NULL,
  advance_rate numeric DEFAULT 90,
  advance_amount numeric NOT NULL,
  retained_amount numeric NOT NULL,
  originator_fee numeric DEFAULT 0,
  funder_fee numeric DEFAULT 0,
  total_fee numeric DEFAULT 0,
  disbursement_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval',
  approved_by uuid,
  approved_at timestamp with time zone,
  disbursed_at timestamp with time zone,
  payment_reference text,
  payment_date date,
  metadata jsonb DEFAULT '{}'::jsonb,
  memo_number text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.disbursement_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all disbursement memos" ON public.disbursement_memos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can manage org disbursement memos" ON public.disbursement_memos FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Borrowers can view own disbursement memos" ON public.disbursement_memos FOR SELECT TO authenticated USING (borrower_id IN (SELECT id FROM borrowers WHERE user_id = auth.uid()));
CREATE POLICY "Org members can view org disbursement memos" ON public.disbursement_memos FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));

-- Repayment memos table
CREATE TABLE public.repayment_memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  disbursement_memo_id uuid NOT NULL REFERENCES public.disbursement_memos(id) ON DELETE CASCADE,
  borrower_id uuid NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  funder_name text,
  counterparty_name text,
  invoice_number text,
  invoice_date date,
  invoice_due_date date,
  repayment_date date,
  invoice_value numeric NOT NULL,
  funding_amount numeric NOT NULL,
  total_fee numeric DEFAULT 0,
  originator_fee numeric DEFAULT 0,
  funder_fee numeric DEFAULT 0,
  disbursement_amount numeric NOT NULL,
  total_repayment numeric NOT NULL,
  balance_due numeric DEFAULT 0,
  overdue_fee numeric DEFAULT 0,
  retained_reimbursement numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_approval',
  approved_by uuid,
  approved_at timestamp with time zone,
  payment_reference text,
  payment_confirmed_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  memo_number text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.repayment_memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all repayment memos" ON public.repayment_memos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Org admins can manage org repayment memos" ON public.repayment_memos FOR ALL TO authenticated USING (has_role(auth.uid(), 'originator_admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "Borrowers can view own repayment memos" ON public.repayment_memos FOR SELECT TO authenticated USING (borrower_id IN (SELECT id FROM borrowers WHERE user_id = auth.uid()));
CREATE POLICY "Org members can view org repayment memos" ON public.repayment_memos FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));

-- Update triggers
CREATE TRIGGER update_facility_requests_updated_at BEFORE UPDATE ON public.facility_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_borrower_lenders_updated_at BEFORE UPDATE ON public.borrower_lenders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_disbursement_memos_updated_at BEFORE UPDATE ON public.disbursement_memos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_repayment_memos_updated_at BEFORE UPDATE ON public.repayment_memos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
