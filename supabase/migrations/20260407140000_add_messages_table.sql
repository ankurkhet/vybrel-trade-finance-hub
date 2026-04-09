-- Phase 5: In-App Chat Redesign
-- Creates a messages table with strict tenancy controls

DROP TABLE IF EXISTS public.messages CASCADE;

CREATE TABLE IF NOT EXISTS public.messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  thread_id     UUID NOT NULL,          -- logical thread grouping; generated client-side or via first insert
  sender_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast retrieval per thread / recipient
CREATE INDEX IF NOT EXISTS idx_messages_thread_id     ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id  ON public.messages(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_organization  ON public.messages(organization_id);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can only see messages they sent or received, within their own org
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
CREATE POLICY "Users can view their messages"
  ON public.messages FOR SELECT
  USING (
    (sender_id = auth.uid() OR recipient_id = auth.uid())
    AND organization_id = get_user_org_id()
  );

-- Users can insert messages only within their org
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND organization_id = get_user_org_id()
  );

-- Users can mark messages as read if they are the recipient
DROP POLICY IF EXISTS "Recipients can mark messages read" ON public.messages;
CREATE POLICY "Recipients can mark messages read"
  ON public.messages FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());
