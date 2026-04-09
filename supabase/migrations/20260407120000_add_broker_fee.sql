ALTER TABLE public.product_fee_configs
ADD COLUMN IF NOT EXISTS broker_fee_pct numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS broker_name text;
