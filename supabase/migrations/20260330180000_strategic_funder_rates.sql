-- Migration: Strategic Funder Rates & Matrix
-- Created: 2026-03-31 (Restored from recovery plan)

-- 1. Reference Rates Table
CREATE TABLE IF NOT EXISTS public.reference_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_name TEXT NOT NULL, -- e.g. 'SOFR', 'EURIBOR', 'SONIA', 'BOE'
    rate_value DECIMAL(10, 5) NOT NULL,
    as_of_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(rate_name)
);

-- Enable RLS for reference_rates
ALTER TABLE public.reference_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reference rates" ON public.reference_rates FOR SELECT TO authenticated USING (true);

-- 2. Enhanced Funder Relationships (Matrix)
-- Adding specific margin columns to funder_relationships if they don't exist
ALTER TABLE public.funder_relationships 
ADD COLUMN IF NOT EXISTS margin_receivable_purchase DECIMAL(10, 5) DEFAULT 0.005,
ADD COLUMN IF NOT EXISTS margin_reverse_factoring DECIMAL(10, 5) DEFAULT 0.005,
ADD COLUMN IF NOT EXISTS margin_payable_finance DECIMAL(10, 5) DEFAULT 0.005,
ADD COLUMN IF NOT EXISTS base_rate_type TEXT DEFAULT 'SOFR'; -- Default base rate index

-- 3. Funder KYC Enhancements
-- These columns likely help with the audit-ready workflow
ALTER TABLE public.funder_kyc
ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS kyc_reviewed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS kyc_reviewer_notes TEXT;

-- 4. Initial Sample Rates
INSERT INTO public.reference_rates (rate_name, rate_value, source)
VALUES 
    ('SOFR', 5.31000, 'Federal Reserve'),
    ('SONIA', 5.19000, 'Bank of England'),
    ('EURIBOR-3M', 3.89000, 'ECB')
ON CONFLICT (rate_name) DO UPDATE SET 
    rate_value = EXCLUDED.rate_value,
    as_of_date = NOW();
