
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_gbp numeric NOT NULL DEFAULT 0,
  max_borrowers integer NOT NULL DEFAULT 10,
  max_funders integer NOT NULL DEFAULT 5,
  max_monthly_volume_gbp numeric NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  is_popular boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Anyone can read active plans (public pricing page)
CREATE POLICY "Anyone can view active plans"
ON public.subscription_plans
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Admins can manage all plans
CREATE POLICY "Admins can manage all plans"
ON public.subscription_plans
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed default plans
INSERT INTO public.subscription_plans (name, price_gbp, max_borrowers, max_funders, max_monthly_volume_gbp, features, is_popular, sort_order) VALUES
('Starter', 400, 10, 3, 500000, '["AI credit memos", "KYC/KYB workflows", "Basic reporting", "Email support"]'::jsonb, false, 1),
('Growth', 800, 50, 10, 2000000, '["Everything in Starter", "White-label branding", "Advanced AI insights", "Priority support", "Custom domain"]'::jsonb, true, 2),
('Enterprise', 2500, -1, -1, -1, '["Everything in Growth", "Dedicated account manager", "SLA guarantees", "SSO & advanced security", "API access", "Custom integrations"]'::jsonb, false, 3);
