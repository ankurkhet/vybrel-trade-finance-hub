-- Migration: Funder Limits Architecture
-- Add partially_settled to whatever enum invoices uses (or if text, nothing needed, but we will assume it's text for now)

CREATE TABLE IF NOT EXISTS public.funder_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    funder_user_id UUID NOT NULL REFERENCES auth.users(id), -- The funder controlling the limit
    borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE, -- The subject
    counterparty_name TEXT, -- Nullable! If null, this is a [Borrower Only] limit
    limit_amount NUMERIC NOT NULL,
    currency VARCHAR(3) DEFAULT 'GBP',
    
    -- The strictly Read-Only Index Rates mapped from the Originator
    base_rate_type TEXT DEFAULT 'Fixed Rate',
    base_rate_value NUMERIC,
    margin_pct NUMERIC,
    
    -- Limit Status
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, suspended
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.funder_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funder_limits_select" ON public.funder_limits
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid() OR user_id = auth.uid()
        )
        OR
        funder_user_id = auth.uid()
    );

CREATE POLICY "funder_limits_insert" ON public.funder_limits
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid() OR user_id = auth.uid()
        )
    );

CREATE POLICY "funder_limits_update" ON public.funder_limits
    FOR UPDATE USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid() OR user_id = auth.uid()
        )
        OR
        funder_user_id = auth.uid()
    );
