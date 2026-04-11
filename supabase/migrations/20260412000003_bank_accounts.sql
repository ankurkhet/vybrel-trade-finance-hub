-- ============================================================
-- Bank Account Management
-- Supports: originator, borrower, funder, broker actors.
-- Verification: manual + TrueLayer name verify (Phase 1).
--   API-based (Modulr/Railsr) deferred to Phase 2.
-- Verified accounts are immutable (no UPDATE rule).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Actor reference
  actor_type            TEXT NOT NULL
    CHECK (actor_type IN ('originator', 'borrower', 'funder', 'broker')),
  actor_id              UUID NOT NULL,
    -- originator: organization.id
    -- borrower:   borrowers.id
    -- funder:     funder_kyc.id or user_id
    -- broker:     brokers.id

  -- Account details
  account_name          TEXT NOT NULL,   -- account holder name
  bank_name             TEXT,
  account_number        TEXT,
  sort_code             TEXT,
  iban                  TEXT,
  bic_swift             TEXT,
  currency              CHAR(3) NOT NULL DEFAULT 'GBP',

  -- Purpose / wallet mapping (for originator accounts)
  fee_wallet            TEXT,            -- e.g. 'originator_revenue', 'platform_revenue', null for general
  is_primary            BOOLEAN NOT NULL DEFAULT false,

  -- Verification
  verification_status   TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending_verification', 'verified', 'failed')),
  verification_method   TEXT DEFAULT 'manual'
    CHECK (verification_method IN ('manual', 'truelayer', 'modulr', 'railsr')),
  truelayer_result      JSONB,           -- raw TrueLayer name-match response
  verified_at           TIMESTAMPTZ,
  verified_by           UUID REFERENCES auth.users(id),
  verification_notes    TEXT,

  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_bank_account_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_bank_account_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_bank_account_updated_at();

-- Prevent modification of verified account details (account number, IBAN, sort code)
-- Originators must deactivate and re-add if banking details change.
CREATE OR REPLACE RULE no_update_verified_bank_account_details AS
  ON UPDATE TO public.bank_accounts
  WHERE OLD.verification_status = 'verified'
    AND (
      NEW.account_number IS DISTINCT FROM OLD.account_number OR
      NEW.iban           IS DISTINCT FROM OLD.iban           OR
      NEW.sort_code      IS DISTINCT FROM OLD.sort_code      OR
      NEW.bic_swift      IS DISTINCT FROM OLD.bic_swift
    )
  DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS bank_accounts_actor ON public.bank_accounts (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS bank_accounts_org ON public.bank_accounts (organization_id);
CREATE INDEX IF NOT EXISTS bank_accounts_status ON public.bank_accounts (verification_status)
  WHERE verification_status IN ('pending_verification', 'unverified');

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Originators and admins can manage all accounts for their org
CREATE POLICY "bank_accounts_org_manage" ON public.bank_accounts
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Org members can view
CREATE POLICY "bank_accounts_org_select" ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (organization_id = public.get_org_from_jwt());

-- Borrowers can view their own bank accounts
CREATE POLICY "bank_accounts_borrower_select" ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (
    actor_type = 'borrower'
    AND actor_id IN (SELECT id FROM public.borrowers WHERE user_id = auth.uid())
  );

-- Funders can view their own bank accounts
CREATE POLICY "bank_accounts_funder_select" ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (
    actor_type = 'funder'
    AND actor_id = auth.uid()
  );
