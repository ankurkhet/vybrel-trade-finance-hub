
-- Add settlement_timing enum type
CREATE TYPE public.settlement_timing AS ENUM ('advance', 'arrears');

-- Add settlement_timing column to product_fee_configs
ALTER TABLE public.product_fee_configs
  ADD COLUMN settlement_timing public.settlement_timing NOT NULL DEFAULT 'arrears';
