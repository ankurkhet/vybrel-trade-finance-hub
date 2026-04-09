-- Add originator_margin_pct to funder_limits
ALTER TABLE public.funder_limits
ADD COLUMN IF NOT EXISTS originator_margin_pct NUMERIC DEFAULT 0;
