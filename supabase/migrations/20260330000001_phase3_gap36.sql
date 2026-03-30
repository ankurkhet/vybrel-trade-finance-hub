-- Migration: GAP-36 Notifications Engine
-- Creates the notifications table and related policies

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    action_url TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_id ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications for users"
ON public.notifications FOR INSERT
WITH CHECK (true); -- Usually called by edge functions or triggers via service role, but allowing authenticated inserts can be helpful for internal messaging features.
