
-- Create fraud check status enum
CREATE TYPE public.fraud_check_status AS ENUM ('passed', 'flagged', 'blocked');

-- Create invoice_fraud_checks table
CREATE TABLE public.invoice_fraud_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  fraud_score numeric(5,2) NOT NULL DEFAULT 0,
  status fraud_check_status NOT NULL DEFAULT 'passed',
  duplicate_matches jsonb DEFAULT '[]'::jsonb,
  rule_results jsonb DEFAULT '[]'::jsonb,
  ai_signals jsonb DEFAULT '{}'::jsonb,
  external_results jsonb DEFAULT '{}'::jsonb,
  reasons text[] DEFAULT '{}',
  checked_at timestamptz NOT NULL DEFAULT now(),
  checked_by uuid,
  override_by uuid,
  override_at timestamptz,
  override_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_fraud_checks_invoice ON public.invoice_fraud_checks(invoice_id);
CREATE INDEX idx_fraud_checks_org ON public.invoice_fraud_checks(organization_id);
CREATE INDEX idx_fraud_checks_status ON public.invoice_fraud_checks(status);

-- Add fraud columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS fraud_score numeric,
  ADD COLUMN IF NOT EXISTS fraud_status text DEFAULT 'pending';

-- Add fraud config to organization_settings
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS fraud_threshold numeric DEFAULT 70,
  ADD COLUMN IF NOT EXISTS fraud_providers_enabled jsonb DEFAULT '[]'::jsonb;

-- Enable RLS
ALTER TABLE public.invoice_fraud_checks ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read
CREATE POLICY "Org members can view fraud checks"
  ON public.invoice_fraud_checks FOR SELECT
  TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS: service role inserts (edge function uses service role)
-- No INSERT policy for authenticated = only service role can insert

-- RLS: only originator_admin can update (for overrides)
CREATE POLICY "Ops managers can override fraud checks"
  ON public.invoice_fraud_checks FOR UPDATE
  TO authenticated
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'originator_admin')
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
    AND public.has_role(auth.uid(), 'originator_admin')
  );

-- RLS: no DELETE (immutable)

-- Trigger: block funding offers on fraud-blocked invoices
CREATE OR REPLACE FUNCTION public.enforce_fraud_check_on_funding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _fraud_status text;
  _has_override boolean;
BEGIN
  SELECT fraud_status INTO _fraud_status
  FROM invoices WHERE id = NEW.invoice_id;

  IF _fraud_status = 'blocked' THEN
    -- Check if there's an override
    SELECT EXISTS(
      SELECT 1 FROM invoice_fraud_checks
      WHERE invoice_id = NEW.invoice_id AND override_by IS NOT NULL
    ) INTO _has_override;

    IF NOT _has_override THEN
      RAISE EXCEPTION 'Invoice is blocked due to fraud check (score too high). Ops manager override required.';
    END IF;
  END IF;

  IF _fraud_status = 'flagged' THEN
    SELECT EXISTS(
      SELECT 1 FROM invoice_fraud_checks
      WHERE invoice_id = NEW.invoice_id AND override_by IS NOT NULL
    ) INTO _has_override;

    IF NOT _has_override THEN
      RAISE EXCEPTION 'Invoice is flagged for fraud review. Ops manager override required before funding.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_fraud_check_on_funding
BEFORE INSERT ON public.funding_offers
FOR EACH ROW EXECUTE FUNCTION public.enforce_fraud_check_on_funding();
