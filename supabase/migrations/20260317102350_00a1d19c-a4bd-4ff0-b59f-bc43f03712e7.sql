
-- Add broker_admin to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'broker_admin';

-- Add broker_user_id to borrowers table
ALTER TABLE public.borrowers ADD COLUMN IF NOT EXISTS broker_user_id uuid;
