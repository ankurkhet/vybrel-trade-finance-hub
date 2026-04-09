-- ============================================================
-- ARCH FIX 4: PSP Virtual Accounts + Payment Instructions
-- Structured tables replacing JSONB payment_instructions pattern.
-- Keeps Vybrel outside PSR 2017 payment institution perimeter.
-- ============================================================

-- PSP virtual account references (one per actor per currency)
CREATE TABLE IF NOT EXISTS public.psp_virtual_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('borrower', 'funder', 'originator')),
  psp_provider TEXT NOT NULL DEFAULT 'manual',  -- e.g. 'modulr', 'railsr', 'manual'
  psp_account_ref TEXT,                          -- PSP's account identifier / IBAN
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS psp_virtual_accounts_actor ON public.psp_virtual_accounts (actor_id, currency);

-- Payment instructions: Vybrel creates, PSP executes
CREATE TABLE IF NOT EXISTS public.payment_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  settlement_advice_id UUID REFERENCES public.settlement_advices(id),
  payer_psp_account_id UUID REFERENCES public.psp_virtual_accounts(id),
  payee_psp_account_id UUID REFERENCES public.psp_virtual_accounts(id),
  amount NUMERIC(20,6) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'submitted', 'confirmed', 'failed', 'cancelled')
  ),
  psp_reference TEXT,         -- PSP's reference / transaction ID
  psp_confirmed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS payment_instructions_settlement ON public.payment_instructions (settlement_advice_id);
CREATE INDEX IF NOT EXISTS payment_instructions_status ON public.payment_instructions (status) WHERE status = 'pending';

-- RLS: PSP accounts
ALTER TABLE public.psp_virtual_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psp_accounts_org_select" ON public.psp_virtual_accounts
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "psp_accounts_admin_manage" ON public.psp_virtual_accounts
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS: Payment instructions
ALTER TABLE public.payment_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_instructions_org_select" ON public.payment_instructions
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "payment_instructions_ops_insert" ON public.payment_instructions
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'originator_admin'::app_role)
    OR has_role(auth.uid(), 'operations_manager'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Payment instructions are immutable once confirmed
CREATE RULE no_delete_payment_instructions AS ON DELETE TO public.payment_instructions DO INSTEAD NOTHING;
