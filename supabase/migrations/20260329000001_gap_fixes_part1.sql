-- Migration: Gap Fixes Part 1 (Schema Constraints)

-- 1. Modify disbursement_memos to track funder matching and maker/checker
ALTER TABLE public.disbursement_memos
ADD COLUMN funder_user_id UUID REFERENCES auth.users(id),
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- 2. Modify invoices and facility_requests to enforce contractual link
ALTER TABLE public.invoices
ADD COLUMN contract_id UUID REFERENCES public.contracts(id);

ALTER TABLE public.facility_requests
ADD COLUMN contract_id UUID REFERENCES public.contracts(id);

-- 3. Add late fields to invoices for dunning engine
ALTER TABLE public.invoices
ADD COLUMN accrued_late_fees NUMERIC DEFAULT 0,
ADD COLUMN last_dunning_date DATE;
