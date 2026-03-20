
-- Messages table for central messaging system
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  message_type text NOT NULL DEFAULT 'general',
  related_entity_type text,
  related_entity_id uuid,
  parent_message_id uuid REFERENCES public.messages(id),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages sent to them
CREATE POLICY "Users can view received messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

-- Users can view messages they sent
CREATE POLICY "Users can view sent messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid());

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Users can update their received messages (mark as read)
CREATE POLICY "Users can update received messages"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid());

-- Admins can manage all messages
CREATE POLICY "Admins can manage all messages"
  ON public.messages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add notes column to documents table for upload notes
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS notes text;

-- Add version tracking columns to documents
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES public.documents(id);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add same columns to org_documents for version tracking
ALTER TABLE public.org_documents ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.org_documents ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES public.org_documents(id);
ALTER TABLE public.org_documents ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.org_documents ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;
ALTER TABLE public.org_documents ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.org_documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
