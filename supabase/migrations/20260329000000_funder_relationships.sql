-- Migration: Funder MSAs and Master Rate Management

CREATE TABLE IF NOT EXISTS public.funder_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    funder_user_id UUID NOT NULL REFERENCES auth.users(id),
    
    master_base_rate_type TEXT NOT NULL DEFAULT 'Fixed Rate',
    master_base_rate_value NUMERIC,
    master_margin_pct NUMERIC,
    default_advance_rate NUMERIC,
    
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    agreement_status TEXT NOT NULL DEFAULT 'active', -- active, superseded, pending
    agreement_document_path TEXT, -- Path in storage bucket "documents"
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.funder_relationships ENABLE ROW LEVEL SECURITY;

-- Originators can select relationship configurations for their org
CREATE POLICY "originator_select_funder_relationships" ON public.funder_relationships
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles WHERE id = auth.uid() OR user_id = auth.uid()
        )
    );

-- Originator Admins can insert/update relationship configurations
CREATE POLICY "originator_admin_modify_funder_relationships" ON public.funder_relationships
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE (id = auth.uid() OR user_id = auth.uid()) 
            AND role = 'originator_admin'
        )
    );

-- Funders can see their own relationship configurations
CREATE POLICY "funder_select_own_relationships" ON public.funder_relationships
    FOR SELECT USING (
        funder_user_id = auth.uid()
    );
