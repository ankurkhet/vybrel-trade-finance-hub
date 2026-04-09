-- ============================================================
-- GAP A: Funder Invitation Renewal
-- Track resend count and last resend time for invitations.
-- ============================================================

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS resent_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_resent_at TIMESTAMPTZ;
