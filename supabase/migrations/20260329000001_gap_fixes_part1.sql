-- Migration: Gap Fixes Part 1 (Schema Constraints)

-- 1. Modify disbursement_memos to track funder matching and maker/checker
ALTER TABLE public.disbursement_memos
ADD COLUMN IF NOT EXISTS funder_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. Modify facility_requests to enforce contractual link
-- Note: invoices.contract_id already exists in the original schema (20260313)
ALTER TABLE public.facility_requests
ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id);

-- 3. Add late fields to invoices for dunning engine
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS accrued_late_fees NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_dunning_date DATE;
