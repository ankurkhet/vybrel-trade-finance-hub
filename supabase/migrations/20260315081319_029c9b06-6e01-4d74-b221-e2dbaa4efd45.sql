-- Collection status enum
CREATE TYPE public.collection_status AS ENUM ('received', 'confirmed', 'disputed', 'reversed');

-- Settlement advice type enum
CREATE TYPE public.settlement_advice_type AS ENUM ('borrower_settlement', 'funder_settlement');

-- Settlement advice status enum
CREATE TYPE public.settlement_advice_status AS ENUM ('draft', 'issued', 'acknowledged', 'paid');

-- Product fee configurations per organization
CREATE TABLE public.product_fee_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_type public.product_type NOT NULL,
  originator_fee_pct NUMERIC NOT NULL DEFAULT 0,
  platform_fee_pct NUMERIC NOT NULL DEFAULT 0,
  default_discount_rate NUMERIC NOT NULL DEFAULT 0,
  settlement_days INTEGER NOT NULL DEFAULT 1,
  payment_instructions JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, product_type)
);

-- Collections table - tracks debtor payment events
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  collected_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_reference TEXT,
  debtor_name TEXT,
  status public.collection_status NOT NULL DEFAULT 'received',
  confirmed_by UUID,
  confirmed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Settlement advices table
CREATE TABLE public.settlement_advices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  advice_number TEXT NOT NULL,
  advice_type public.settlement_advice_type NOT NULL,
  -- Parties
  from_party_name TEXT NOT NULL,
  to_party_name TEXT NOT NULL,
  to_party_email TEXT,
  to_borrower_id UUID REFERENCES public.borrowers(id),
  to_funder_user_id UUID,
  -- Financial details
  invoice_id UUID REFERENCES public.invoices(id),
  product_type public.product_type,
  gross_amount NUMERIC NOT NULL,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  originator_fee NUMERIC NOT NULL DEFAULT 0,
  platform_fee NUMERIC NOT NULL DEFAULT 0,
  other_deductions NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  -- Fee breakdown detail
  fee_breakdown JSONB DEFAULT '[]'::jsonb,
  -- Payment instructions
  payment_instructions JSONB DEFAULT '{}'::jsonb,
  -- Status
  status public.settlement_advice_status NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  -- PDF
  pdf_path TEXT,
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_fee_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_advices ENABLE ROW LEVEL SECURITY;

-- RLS: product_fee_configs
CREATE POLICY "Admins can manage all fee configs" ON public.product_fee_configs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can manage own fee configs" ON public.product_fee_configs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'originator_admin') AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Org members can view fee configs" ON public.product_fee_configs
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

-- RLS: collections
CREATE POLICY "Admins can manage all collections" ON public.collections
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can manage org collections" ON public.collections
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'originator_admin') AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Org members can view org collections" ON public.collections
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id(auth.uid()));

-- RLS: settlement_advices
CREATE POLICY "Admins can manage all settlement advices" ON public.settlement_advices
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Org admins can manage org settlement advices" ON public.settlement_advices
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'originator_admin') AND organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Borrowers can view own settlement advices" ON public.settlement_advices
  FOR SELECT TO authenticated
  USING (
    advice_type = 'borrower_settlement'
    AND to_borrower_id IN (SELECT id FROM borrowers WHERE user_id = auth.uid())
  );

CREATE POLICY "Funders can view own settlement advices" ON public.settlement_advices
  FOR SELECT TO authenticated
  USING (
    advice_type = 'funder_settlement'
    AND to_funder_user_id = auth.uid()
  );

-- Triggers for updated_at
CREATE TRIGGER update_product_fee_configs_updated_at
  BEFORE UPDATE ON public.product_fee_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settlement_advices_updated_at
  BEFORE UPDATE ON public.settlement_advices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();