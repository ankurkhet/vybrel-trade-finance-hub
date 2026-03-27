
-- Add missing onboarding_status enum values to align UI with DB
ALTER TYPE public.onboarding_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.onboarding_status ADD VALUE IF NOT EXISTS 'documents_requested';
ALTER TYPE public.onboarding_status ADD VALUE IF NOT EXISTS 'onboarded';
