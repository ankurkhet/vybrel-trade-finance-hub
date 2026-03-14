-- Create funding_offers table for funder marketplace
CREATE TABLE public.funding_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  funder_user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  offer_amount numeric NOT NULL,
  discount_rate numeric,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  offered_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.funding_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funders can view own offers"
ON public.funding_offers FOR SELECT TO authenticated
USING (funder_user_id = auth.uid());

CREATE POLICY "Funders can insert own offers"
ON public.funding_offers FOR INSERT TO authenticated
WITH CHECK (funder_user_id = auth.uid());

CREATE POLICY "Admins can manage all offers"
ON public.funding_offers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Org members can view org offers"
ON public.funding_offers FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE TRIGGER update_funding_offers_updated_at
  BEFORE UPDATE ON public.funding_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.funding_offers;