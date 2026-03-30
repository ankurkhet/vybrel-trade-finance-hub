-- Migration: Phase 3 Gap Fixes
-- GAP-09: Funder KYC table
-- GAP-33: Add superseded status to funder_relationships 
-- GAP-34: Add created_by to repayment_memos

-- Funder KYC/Onboarding table
CREATE TABLE IF NOT EXISTS public.funder_kyc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    organization_id UUID REFERENCES public.organizations(id),
    status TEXT NOT NULL DEFAULT 'draft', -- draft, submitted, under_review, approved, rejected
    -- Entity Info
    entity_name TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- bank, nbfi, fund, corporate, other
    registration_number TEXT,
    country_of_incorporation TEXT DEFAULT 'United Kingdom',
    registered_address TEXT,
    -- Contact
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    -- Regulatory
    regulatory_status TEXT,
    regulator_name TEXT,
    licence_number TEXT,
    -- Compliance
    aml_policy_confirmed BOOLEAN DEFAULT FALSE,
    pep_screening_confirmed BOOLEAN DEFAULT FALSE,
    sanctions_screening_confirmed BOOLEAN DEFAULT FALSE,
    -- Banking
    bank_name TEXT,
    bank_account_name TEXT,
    bank_account_number TEXT,
    bank_sort_code TEXT,
    bank_iban TEXT,
    bank_swift TEXT,
    -- Other
    notes TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for funder_kyc
ALTER TABLE public.funder_kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funders can view own KYC" ON public.funder_kyc
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Funders can manage own KYC" ON public.funder_kyc
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all KYC" ON public.funder_kyc
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'originator_admin'))
    );

CREATE POLICY "Admins can update KYC" ON public.funder_kyc
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'originator_admin'))
    );

-- GAP-34: Add created_by to repayment_memos for maker-checker
ALTER TABLE public.repayment_memos
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
