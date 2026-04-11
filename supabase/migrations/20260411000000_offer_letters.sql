-- ============================================================
-- PRD Section 8: Offer Letters
-- Top-level borrower-facing document. One per borrower per product.
-- Spawns one facilities row per currency on issuance.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS public.offer_letter_seq START 1000;

CREATE TABLE IF NOT EXISTS public.offer_letters (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  borrower_id               UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE CASCADE,

  -- Auto-generated reference e.g. OL-20260411-01001
  offer_number              TEXT NOT NULL UNIQUE,

  product_type              TEXT NOT NULL CHECK (product_type IN (
    'invoice_discounting',
    'reverse_factoring',
    'inventory_finance',
    'structured_trade_finance',
    'working_capital_revolving',
    'other'
  )),

  status                    TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',
    'issued',
    'pending_acceptance',
    'active',
    'expired',
    'cancelled'
  )),

  -- Consolidated fee fields (borrower-visible, no funder breakdown)
  platform_fee_pct          NUMERIC(8, 5) DEFAULT 0,
  overdue_fee_pct           NUMERIC(8, 5) DEFAULT 0,
  max_invoice_amount        NUMERIC(20, 6),

  -- Settlement behaviour
  settlement_type           TEXT DEFAULT 'advance' CHECK (settlement_type IN ('advance', 'maturity')),

  -- Validity window
  valid_from                DATE,
  valid_to                  DATE,

  -- Workflow
  facility_request_id       UUID REFERENCES public.facility_requests(id),
  issued_at                 TIMESTAMPTZ,
  issued_by                 UUID REFERENCES auth.users(id),
  accepted_at               TIMESTAMPTZ,
  accepted_by               UUID REFERENCES auth.users(id),
  cancelled_at              TIMESTAMPTZ,
  cancelled_by              UUID REFERENCES auth.users(id),
  cancellation_reason       TEXT,

  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate offer number on insert
CREATE OR REPLACE FUNCTION public.set_offer_letter_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.offer_number IS NULL OR NEW.offer_number = '' THEN
    NEW.offer_number := 'OL-' || to_char(now(), 'YYYYMMDD') || '-'
      || lpad(nextval('public.offer_letter_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_offer_letter_number
  BEFORE INSERT ON public.offer_letters
  FOR EACH ROW EXECUTE FUNCTION public.set_offer_letter_number();

CREATE OR REPLACE FUNCTION public.set_offer_letter_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_offer_letter_updated_at
  BEFORE UPDATE ON public.offer_letters
  FOR EACH ROW EXECUTE FUNCTION public.set_offer_letter_updated_at();

CREATE INDEX IF NOT EXISTS offer_letters_org ON public.offer_letters (organization_id);
CREATE INDEX IF NOT EXISTS offer_letters_borrower ON public.offer_letters (borrower_id);
CREATE INDEX IF NOT EXISTS offer_letters_status ON public.offer_letters (status) WHERE status NOT IN ('cancelled', 'expired');

-- RLS
ALTER TABLE public.offer_letters ENABLE ROW LEVEL SECURITY;

-- Originators can view all offer letters for their org
CREATE POLICY "offer_letters_org_select" ON public.offer_letters
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Borrowers can view their own offer letters (consolidated view, no funder detail exposed here)
CREATE POLICY "offer_letters_borrower_select" ON public.offer_letters
  FOR SELECT TO authenticated
  USING (
    borrower_id IN (
      SELECT id FROM public.borrowers WHERE user_id = auth.uid()
    )
  );

-- Only originator_admin can create/update
CREATE POLICY "offer_letters_originator_manage" ON public.offer_letters
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );
