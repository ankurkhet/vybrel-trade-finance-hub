-- GAP-20: Add template_id FK to contracts table
ALTER TABLE public.contracts 
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contracts.template_id IS 'GAP-20: Links contract to the document template used at creation time for auditability.';
