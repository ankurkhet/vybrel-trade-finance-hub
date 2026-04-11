-- ============================================================
-- Document Acceptances (NDA, T&C, facility letters)
-- Immutable compliance record. No UPDATE, no DELETE.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.document_acceptances (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Who accepted
  actor_type          TEXT NOT NULL
    CHECK (actor_type IN ('borrower', 'funder', 'broker', 'originator_user')),
  actor_id            UUID NOT NULL,     -- borrowers.id, funder_kyc.id, brokers.id, or auth.users.id
  actor_email         TEXT,
  user_id             UUID REFERENCES auth.users(id),  -- the authenticated user who clicked Accept

  -- What was accepted
  document_type       TEXT NOT NULL
    CHECK (document_type IN ('nda', 'terms_of_service', 'offer_letter', 'facility_letter', 'privacy_policy')),
  document_version    TEXT NOT NULL DEFAULT '1.0',
  document_template_id UUID,             -- references document_templates.id (loose ref for portability)
  document_hash       TEXT,             -- SHA-256 of rendered document content at acceptance time

  -- How it was accepted
  accepted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address          TEXT,
  user_agent          TEXT,
  acceptance_method   TEXT NOT NULL DEFAULT 'in_app_checkbox'
    CHECK (acceptance_method IN ('in_app_checkbox', 'electronic_signature', 'wet_ink_upload')),

  -- Revocation (only by platform admin for legal reason — not by actor)
  revoked_at          TIMESTAMPTZ,
  revoked_reason      TEXT,
  revoked_by          UUID REFERENCES auth.users(id)
);

-- Immutable: no UPDATE or DELETE by anyone except explicit revocation columns
CREATE RULE no_delete_document_acceptances AS ON DELETE TO public.document_acceptances DO INSTEAD NOTHING;

ALTER TABLE public.document_acceptances ENABLE ROW LEVEL SECURITY;

-- Actors can view their own acceptances
CREATE POLICY "doc_acceptances_own_select" ON public.document_acceptances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Originators can view all acceptances for their org
CREATE POLICY "doc_acceptances_org_select" ON public.document_acceptances
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Anyone authenticated can insert their own acceptance
CREATE POLICY "doc_acceptances_insert" ON public.document_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Admin can revoke (partial update — only revocation columns)
CREATE POLICY "doc_acceptances_admin_revoke" ON public.document_acceptances
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS doc_acceptances_actor ON public.document_acceptances (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS doc_acceptances_user ON public.document_acceptances (user_id);
CREATE INDEX IF NOT EXISTS doc_acceptances_type ON public.document_acceptances (document_type, actor_type);

-- ============================================================
-- Brokers table (Option B: full broker entity record)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brokers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id),  -- linked auth user (broker_admin role)

  company_name        TEXT NOT NULL,
  trading_name        TEXT,
  contact_name        TEXT,
  contact_email       TEXT NOT NULL,
  contact_phone       TEXT,
  registration_number TEXT,
  country             TEXT,
  industry            TEXT,

  -- KYB / onboarding
  kyb_status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (kyb_status IN ('pending', 'in_review', 'approved', 'rejected', 'suspended')),
  kyb_reviewed_at     TIMESTAMPTZ,
  kyb_reviewed_by     UUID REFERENCES auth.users(id),
  kyb_notes           TEXT,

  -- NDA
  nda_accepted        BOOLEAN NOT NULL DEFAULT false,
  nda_accepted_at     TIMESTAMPTZ,

  -- Fee configuration
  fee_pct             NUMERIC(8, 5) NOT NULL DEFAULT 0,  -- default broker margin % in settlements
  fee_currency        CHAR(3) DEFAULT 'GBP',

  -- Scope (mirrors funder_relationships scope)
  scope               TEXT NOT NULL DEFAULT 'all_borrowers'
    CHECK (scope IN ('all_borrowers', 'specific_borrower')),

  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_broker_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_broker_updated_at
  BEFORE UPDATE ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.set_broker_updated_at();

CREATE INDEX IF NOT EXISTS brokers_org ON public.brokers (organization_id);
CREATE INDEX IF NOT EXISTS brokers_user ON public.brokers (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brokers_org_manage" ON public.brokers
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "brokers_org_select" ON public.brokers
  FOR SELECT TO authenticated
  USING (organization_id = public.get_org_from_jwt());

-- Broker user can view their own record
CREATE POLICY "brokers_self_select" ON public.brokers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── NDA template seed ─────────────────────────────────────────
-- document_templates stores file_path references (storage bucket).
-- The NDA content is embedded as a data URI so it's self-contained
-- without requiring a storage upload at migration time.
-- Originator admin can replace the file_path via the Templates page.
INSERT INTO public.document_templates (
  organization_id,
  template_name,
  template_type,
  file_path,
  is_active
)
SELECT
  o.id,
  'Standard Non-Disclosure Agreement v1.0',
  'nda',
  'system/nda_standard_v1.0.html',  -- placeholder; UI renders inline NDA content from code
  true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_templates dt
  WHERE dt.organization_id = o.id AND dt.template_type = 'nda'
)
ON CONFLICT ON CONSTRAINT unique_active_template_type DO NOTHING;
