
-- 1. Create reference_rates table
CREATE TABLE IF NOT EXISTS public.reference_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_name TEXT NOT NULL UNIQUE,
    rate_value DECIMAL(10, 5) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.reference_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reference rates"
ON public.reference_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage reference rates"
ON public.reference_rates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Add missing columns to funder_relationships
ALTER TABLE public.funder_relationships
ADD COLUMN IF NOT EXISTS base_rate_type TEXT DEFAULT 'SOFR',
ADD COLUMN IF NOT EXISTS margin_receivable_purchase DECIMAL(10, 5) DEFAULT 0.005,
ADD COLUMN IF NOT EXISTS margin_reverse_factoring DECIMAL(10, 5) DEFAULT 0.005,
ADD COLUMN IF NOT EXISTS margin_payable_finance DECIMAL(10, 5) DEFAULT 0.005;

-- 3. Add pending_document_review to acceptance_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_document_review' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'acceptance_status')) THEN
    ALTER TYPE public.acceptance_status ADD VALUE 'pending_document_review';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'accepted_via_document' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'acceptance_status')) THEN
    ALTER TYPE public.acceptance_status ADD VALUE 'accepted_via_document';
  END IF;
END$$;

-- 4. Seed initial reference rates
INSERT INTO public.reference_rates (rate_name, rate_value, source)
VALUES 
    ('SOFR', 5.31000, 'Federal Reserve'),
    ('SONIA', 5.19000, 'Bank of England'),
    ('EURIBOR-3M', 3.89000, 'ECB'),
    ('BOE', 5.25000, 'Bank of England'),
    ('Fixed', 0.00000, 'Static')
ON CONFLICT (rate_name) DO UPDATE SET 
    rate_value = EXCLUDED.rate_value,
    last_updated = NOW();

-- 5. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
