-- ============================================================
-- Org Active Products
-- Replaces product_fee_configs as the product-selection mechanism.
-- Originators activate which trade finance products they offer.
-- Fees live on Offer Letters / Facilities — not here.
-- product_fee_configs is retained as EMERGENCY FALLBACK ONLY.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_active_products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_type     TEXT NOT NULL,  -- matches product_type enum values
  is_active        BOOLEAN NOT NULL DEFAULT false,
  display_name     TEXT,           -- custom name shown to borrowers e.g. "Invoice Finance"
  description      TEXT,           -- short description for borrower onboarding UI
  activated_at     TIMESTAMPTZ,
  activated_by     UUID REFERENCES auth.users(id),
  deactivated_at   TIMESTAMPTZ,
  deactivated_by   UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, product_type)
);

CREATE OR REPLACE FUNCTION public.set_oap_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_oap_updated_at
  BEFORE UPDATE ON public.org_active_products
  FOR EACH ROW EXECUTE FUNCTION public.set_oap_updated_at();

ALTER TABLE public.org_active_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oap_org_select" ON public.org_active_products
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "oap_originator_manage" ON public.org_active_products
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Seed default inactive rows for all existing orgs and all product types
INSERT INTO public.org_active_products (organization_id, product_type, is_active, display_name)
SELECT
  o.id,
  p.product_type,
  false,
  CASE p.product_type
    WHEN 'receivables_purchase'      THEN 'Invoice Discounting'
    WHEN 'reverse_factoring'         THEN 'Reverse Factoring'
    WHEN 'payables_finance'          THEN 'Payables Finance'
    WHEN 'invoice_discounting'       THEN 'Invoice Discounting'
    WHEN 'inventory_finance'         THEN 'Inventory Finance'
    WHEN 'structured_trade_finance'  THEN 'Structured Trade Finance'
    WHEN 'working_capital_revolving' THEN 'Working Capital Revolving'
    ELSE p.product_type
  END
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('receivables_purchase'),
    ('reverse_factoring'),
    ('payables_finance'),
    ('invoice_discounting'),
    ('inventory_finance'),
    ('structured_trade_finance'),
    ('working_capital_revolving')
) AS p(product_type)
ON CONFLICT (organization_id, product_type) DO NOTHING;

COMMENT ON TABLE public.org_active_products IS
  'Controls which trade finance products an originator offers. Fees are NOT stored here — they live on offer_letters and facilities. product_fee_configs is retained as last-resort fallback in generate-settlement only.';
