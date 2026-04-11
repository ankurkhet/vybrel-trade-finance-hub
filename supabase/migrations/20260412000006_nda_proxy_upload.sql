-- ============================================================
-- NDA proxy upload: originators and admins can record NDA
-- acceptance on behalf of borrowers/funders/brokers.
-- ============================================================

-- Add accepted_by_proxy column (the originator/admin who uploaded)
ALTER TABLE public.document_acceptances
  ADD COLUMN IF NOT EXISTS accepted_by_proxy UUID REFERENCES auth.users(id);

-- Allow originator_admin and admin to insert proxy acceptances
CREATE POLICY "doc_acceptances_proxy_insert" ON public.document_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Ensure borrowers.nda_signed and nda_signed_at columns exist
ALTER TABLE public.borrowers
  ADD COLUMN IF NOT EXISTS nda_signed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nda_signed_at TIMESTAMPTZ;

-- Allow originator_admin to update nda_signed on borrowers in their org
-- (existing RLS on borrowers should already cover this via org_id check)
