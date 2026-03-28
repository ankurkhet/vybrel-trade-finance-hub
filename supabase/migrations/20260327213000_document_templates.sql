-- Create document_templates table
CREATE TABLE IF NOT EXISTS public.document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    template_name TEXT NOT NULL,
    template_type TEXT NOT NULL, -- e.g. 'nda', 'facility_offer', 'legal_agreement', 'letter_of_assignment'
    file_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT unique_active_template_type UNIQUE (organization_id, template_type, is_active)
);

-- RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's templates"
    ON public.document_templates FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM public.user_roles WHERE user_id = auth.uid()
    ));

CREATE POLICY "Originator admins can manage their organization's templates"
    ON public.document_templates FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('originator_admin', 'super_admin')
    ));
