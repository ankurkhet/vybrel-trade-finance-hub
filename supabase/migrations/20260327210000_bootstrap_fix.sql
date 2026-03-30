-- Bootstrap fix: Enable pgcrypto and add missing super_admin role
-- This file is named to run before the failing document_templates migration
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
