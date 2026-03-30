-- Add pending_document_review to acceptance_status
ALTER TYPE public.acceptance_status ADD VALUE IF NOT EXISTS 'pending_document_review';
