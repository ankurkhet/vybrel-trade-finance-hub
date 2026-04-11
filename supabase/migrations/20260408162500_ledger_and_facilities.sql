-- Phase: Wallet & Ledger Core & Pricing Facilities
-- Flushes legacy facility data per user review, introduces balanced journals and PSP tasks.

-- 1. FLUSH LEGACY FACILITY DATA
-- Cascading truncate to wipe the old facility_requests model data.
TRUNCATE TABLE public.invoices CASCADE;
TRUNCATE TABLE public.facility_requests CASCADE;

-- 2. MODULE 3: WALLET & LEDGER CORE

-- PSP Accounts
CREATE TABLE IF NOT EXISTS public.psp_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    psp_reference TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(actor_id, psp_reference)
);

ALTER TABLE public.psp_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psp_accounts_select" ON public.psp_accounts FOR SELECT TO authenticated USING (actor_id = auth.uid() OR organization_id = get_user_organization_id(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Immutable Double-Entry Journals
CREATE TABLE IF NOT EXISTS public.journals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    journal_type TEXT NOT NULL, -- 'disbursement', 'collection', 'fee', 'margin', 'top-up', 'withdrawal'
    reference_id UUID,          -- loose ref to invoice, verification task
    account_id UUID REFERENCES auth.users(id),
    system_account TEXT,
    amount NUMERIC(15, 2) NOT NULL,
    direction TEXT CHECK (direction IN ('credit', 'debit')),
    currency TEXT NOT NULL DEFAULT 'GBP',
    description TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enforce immutability
CREATE OR REPLACE RULE no_update_journals AS ON UPDATE TO public.journals DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_journals AS ON DELETE TO public.journals DO INSTEAD NOTHING;

ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journals_select" ON public.journals FOR SELECT TO authenticated USING (
    account_id = auth.uid() OR 
    organization_id = get_user_organization_id(auth.uid()) OR 
    has_role(auth.uid(), 'admin'::app_role)
);

-- RPC for posting balanced batches
CREATE OR REPLACE FUNCTION public.post_journal_batch(entries jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_debit NUMERIC := 0;
    total_credit NUMERIC := 0;
    entry jsonb;
BEGIN
    FOR entry IN SELECT * FROM jsonb_array_elements(entries)
    LOOP
        IF entry->>'direction' = 'debit' THEN
            total_debit := total_debit + (entry->>'amount')::NUMERIC;
        ELSIF entry->>'direction' = 'credit' THEN
            total_credit := total_credit + (entry->>'amount')::NUMERIC;
        END IF;
    END LOOP;

    IF total_debit <> total_credit THEN
        RAISE EXCEPTION 'Journal batch is unbalanced. Debits: %, Credits: %', total_debit, total_credit;
    END IF;

    FOR entry IN SELECT * FROM jsonb_array_elements(entries)
    LOOP
        INSERT INTO public.journals (
            organization_id, journal_type, reference_id, account_id, system_account, amount, direction, currency, description, created_by
        ) VALUES (
            (entry->>'organization_id')::UUID,
            entry->>'journal_type',
            (NULLIF(entry->>'reference_id', ''))::UUID,
            (NULLIF(entry->>'account_id', ''))::UUID,
            entry->>'system_account',
            (entry->>'amount')::NUMERIC,
            entry->>'direction',
            COALESCE(entry->>'currency', 'GBP'),
            entry->>'description',
            auth.uid()
        );
    END LOOP;
END;
$$;

-- Wallets View (negative values are inherently handled via debit / credit math)
CREATE OR REPLACE VIEW public.wallets AS
SELECT
    COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::UUID) as actor_id,
    system_account,
    organization_id,
    currency,
    SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) - 
    SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) AS balance,
    MAX(created_at) as last_updated_at
FROM public.journals
GROUP BY account_id, system_account, organization_id, currency;

-- Wallet Transactions View
CREATE OR REPLACE VIEW public.wallet_transactions AS
SELECT
    j.id as journal_id,
    COALESCE(j.account_id, '00000000-0000-0000-0000-000000000000'::UUID) as actor_id,
    j.system_account,
    j.organization_id,
    j.transaction_date,
    j.journal_type,
    j.reference_id,
    j.amount,
    j.direction,
    j.currency,
    j.description
FROM public.journals j;

-- Manual Bank Statement Verification Workflow
CREATE TABLE IF NOT EXISTS public.bank_statement_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL, -- 'settlement', 'disbursement'
    status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    reference_id UUID, -- Optional Invoice ID or Settlement Batch ID
    statement_file_url TEXT, -- Uploaded bank statement
    assigned_to_role TEXT DEFAULT 'account_manager',
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.bank_statement_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bank_statement_verifications_select" ON public.bank_statement_verifications FOR SELECT TO authenticated USING (organization_id = get_user_organization_id(auth.uid()));
CREATE POLICY "bank_statement_verifications_all" ON public.bank_statement_verifications FOR ALL TO authenticated USING (has_role(auth.uid(), 'account_manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 3. MODULE 4: PRICING & FACILITY MANAGEMENT

CREATE TABLE IF NOT EXISTS public.facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    borrower_id UUID NOT NULL REFERENCES auth.users(id),
    product_type TEXT,
    currency TEXT DEFAULT 'GBP',
    advance_rate NUMERIC(5, 2) DEFAULT 80.00,
    settlement_type TEXT DEFAULT 'advance',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facilities_select" ON public.facilities FOR SELECT TO authenticated USING (
    organization_id = get_user_organization_id(auth.uid()) OR borrower_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "facilities_manage" ON public.facilities FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'originator_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Helper struct for select permissions
CREATE OR REPLACE FUNCTION public.borrower_id_from_facility(fac_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    b_id UUID;
BEGIN
    SELECT borrower_id INTO b_id FROM public.facilities WHERE id = fac_id;
    RETURN b_id;
END;
$$;

CREATE TABLE IF NOT EXISTS public.facility_funder_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    funder_user_id UUID NOT NULL REFERENCES auth.users(id),
    funder_base_rate NUMERIC(10, 4) DEFAULT 0,
    funder_margin NUMERIC(10, 4) DEFAULT 0,
    originator_margin NUMERIC(10, 4) DEFAULT 0,
    broker_margin NUMERIC(10, 4) DEFAULT 0,
    final_discounting_rate NUMERIC(10, 4) GENERATED ALWAYS AS (
        COALESCE(funder_base_rate, 0) + COALESCE(funder_margin, 0) + COALESCE(originator_margin, 0) + COALESCE(broker_margin, 0)
    ) STORED,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_to TIMESTAMP WITH TIME ZONE,
    UNIQUE(facility_id, funder_user_id)
);

ALTER TABLE public.facility_funder_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "funder_pricing_select" ON public.facility_funder_pricing FOR SELECT TO authenticated USING (
    facility_id IN (SELECT id FROM public.facilities WHERE organization_id = get_user_organization_id(auth.uid())) OR 
    borrower_id_from_facility(facility_id) = auth.uid() OR
    has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "funder_pricing_manage" ON public.facility_funder_pricing FOR ALL TO authenticated USING (
    has_role(auth.uid(), 'originator_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);
