-- RUN THIS IN YOUR SUPABASE SQL EDITOR (PROJECT: hngzrhsigrttsqviphlb)
-- Dashboard URL: https://supabase.com/dashboard/project/hngzrhsigrttsqviphlb/sql

-- 1. Create reference_rates table (Central Rate Index)
CREATE TABLE IF NOT EXISTS public.reference_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_name TEXT NOT NULL,
    rate_value DECIMAL(10, 5) NOT NULL,
    as_of_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(rate_name)
);

-- Enable RLS for reference_rates
ALTER TABLE public.reference_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read reference rates" ON public.reference_rates;
CREATE POLICY "Public read reference rates" ON public.reference_rates FOR SELECT TO authenticated USING (true);

-- 2. Add missing Matrix columns to funder_relationships
ALTER TABLE public.funder_relationships 
ADD COLUMN IF NOT EXISTS margin_receivable_purchase DECIMAL(10, 5) DEFAULT 0.005,
ADD COLUMN IF NOT EXISTS margin_reverse_factoring DECIMAL(10, 5) DEFAULT 0.005,
ADD COLUMN IF NOT EXISTS margin_payable_finance DECIMAL(10, 5) DEFAULT 0.005;

-- This is the specific column causing the error
ALTER TABLE public.funder_relationships 
ADD COLUMN IF NOT EXISTS base_rate_type TEXT DEFAULT 'SOFR';

-- 3. Initial Sample Rates for Matrix Calculation
INSERT INTO public.reference_rates (rate_name, rate_value, source)
VALUES 
    ('SOFR', 5.31000, 'Federal Reserve'),
    ('SONIA', 5.19000, 'Bank of England'),
    ('EURIBOR-3M', 3.89000, 'ECB')
ON CONFLICT (rate_name) DO UPDATE SET 
    rate_value = EXCLUDED.rate_value,
    as_of_date = NOW();

-- 4. MANUALLY FORCE SCHEMA CACHE RELOAD
-- This command signals PostgREST to re-introspection the database
NOTIFY pgrst, 'reload schema';

-- Verification Query (Run this to be sure)
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'funder_relationships' AND column_name = 'base_rate_type';
