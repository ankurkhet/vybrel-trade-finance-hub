-- ============================================================
-- Transaction IDs & Linkage
-- Adds sequential reference numbers to collections, repayments,
-- settlement_advices, funder_limits, journals (batch ref).
-- Updates disbursement_memos prefix DM- → DIS- (new rows only).
-- Updates disbursement_advices prefix DA- → DAV- (new rows only).
-- Updates offer_letters prefix OL- → OFL- (new rows only).
-- Creates transaction_links table for full lifecycle audit trail.
-- ============================================================

-- ── Collections: COL-YYYYMMDD-NNNNN ───────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.collection_seq START 1000;

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS collection_number TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.set_collection_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.collection_number IS NULL OR NEW.collection_number = '' THEN
    NEW.collection_number := 'COL-' || to_char(now(), 'YYYYMMDD') || '-'
      || lpad(nextval('public.collection_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_collection_number ON public.collections;
CREATE TRIGGER trg_set_collection_number
  BEFORE INSERT ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.set_collection_number();

-- ── Settlement advices: SBW- / SFD- YYYYMMDD-NNNNN ───────────
CREATE SEQUENCE IF NOT EXISTS public.settlement_advice_seq START 1000;

ALTER TABLE public.settlement_advices
  ADD COLUMN IF NOT EXISTS settlement_number TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.set_settlement_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.settlement_number IS NULL OR NEW.settlement_number = '' THEN
    DECLARE
      prefix TEXT;
    BEGIN
      prefix := CASE
        WHEN NEW.advice_type::text = 'funder_settlement' THEN 'SFD'
        ELSE 'SBW'
      END;
      NEW.settlement_number := prefix || '-' || to_char(now(), 'YYYYMMDD') || '-'
        || lpad(nextval('public.settlement_advice_seq')::text, 5, '0');
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_settlement_number ON public.settlement_advices;
CREATE TRIGGER trg_set_settlement_number
  BEFORE INSERT ON public.settlement_advices
  FOR EACH ROW EXECUTE FUNCTION public.set_settlement_number();

-- ── Funder limits: FLM-YYYYMMDD-NNNNN ────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.funder_limit_seq START 1000;

ALTER TABLE public.funder_limits
  ADD COLUMN IF NOT EXISTS limit_number TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.set_funder_limit_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.limit_number IS NULL OR NEW.limit_number = '' THEN
    NEW.limit_number := 'FLM-' || to_char(now(), 'YYYYMMDD') || '-'
      || lpad(nextval('public.funder_limit_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_funder_limit_number ON public.funder_limits;
CREATE TRIGGER trg_set_funder_limit_number
  BEFORE INSERT ON public.funder_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_funder_limit_number();

-- ── Journal batch reference: JRN-YYYYMMDD-NNNNN ──────────────
-- Added to journals as a batch grouping column so all entries
-- from one post_journal_batch call share a single reference.
CREATE SEQUENCE IF NOT EXISTS public.journal_batch_seq START 1000;

ALTER TABLE public.journals
  ADD COLUMN IF NOT EXISTS batch_ref TEXT;

CREATE INDEX IF NOT EXISTS journals_batch_ref ON public.journals (batch_ref);

-- Update post_journal_batch to stamp a shared batch_ref on all entries
-- Must drop first because we're changing the return type from void → TEXT
DROP FUNCTION IF EXISTS public.post_journal_batch(jsonb);

CREATE OR REPLACE FUNCTION public.post_journal_batch(entries jsonb)
RETURNS TEXT   -- returns the batch_ref (was void; callers can ignore the return)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_debit  NUMERIC := 0;
  total_credit NUMERIC := 0;
  entry        jsonb;
  v_batch_ref  TEXT;
BEGIN
  -- Generate shared batch reference
  v_batch_ref := 'JRN-' || to_char(now(), 'YYYYMMDD') || '-'
    || lpad(nextval('public.journal_batch_seq')::text, 5, '0');

  FOR entry IN SELECT * FROM jsonb_array_elements(entries)
  LOOP
    IF entry->>'direction' = 'debit' THEN
      total_debit := total_debit + (entry->>'amount')::NUMERIC;
    ELSIF entry->>'direction' = 'credit' THEN
      total_credit := total_credit + (entry->>'amount')::NUMERIC;
    END IF;
  END LOOP;

  IF round(total_debit::NUMERIC, 6) <> round(total_credit::NUMERIC, 6) THEN
    RAISE EXCEPTION 'Journal batch is unbalanced. Debits: %, Credits: %', total_debit, total_credit;
  END IF;

  FOR entry IN SELECT * FROM jsonb_array_elements(entries)
  LOOP
    INSERT INTO public.journals (
      organization_id, journal_type, reference_id, account_id, system_account,
      amount, direction, currency, description, created_by, batch_ref
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
      auth.uid(),
      v_batch_ref
    );
  END LOOP;

  RETURN v_batch_ref;
END;
$$;

-- ── Update disbursement_memos prefix: DM- → DIS- (new rows) ──
CREATE OR REPLACE FUNCTION public.generate_memo_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.memo_number IS NULL OR NEW.memo_number = '' THEN
    NEW.memo_number := 'DIS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-'
      || LPAD(nextval('disbursement_memo_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- ── Update disbursement_advices prefix: DA- → DAV- (new rows) ─
CREATE OR REPLACE FUNCTION public.set_disbursement_advice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.advice_number IS NULL OR NEW.advice_number = '' THEN
    NEW.advice_number := 'DAV-' || to_char(now(), 'YYYYMMDD') || '-'
      || lpad(nextval('public.disbursement_advice_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- ── Update offer_letters prefix: OL- → OFL- (new rows) ───────
CREATE OR REPLACE FUNCTION public.set_offer_letter_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.offer_number IS NULL OR NEW.offer_number = '' THEN
    NEW.offer_number := 'OFL-' || to_char(now(), 'YYYYMMDD') || '-'
      || lpad(nextval('public.offer_letter_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- ── Transaction links table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transaction_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Source
  source_type     TEXT NOT NULL,   -- invoice_submission | disbursement_memo | disbursement_advice | collection | settlement_advice | repayment
  source_id       UUID NOT NULL,
  source_ref      TEXT NOT NULL,   -- human-readable e.g. REQ-20260412-00001
  -- Target
  target_type     TEXT NOT NULL,
  target_id       UUID NOT NULL,
  target_ref      TEXT NOT NULL,
  -- Relationship
  link_type       TEXT NOT NULL,   -- funded_by | advised_by | collected_from | settled_by | repaid_by | journaled_by
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transaction_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "txn_links_org_select" ON public.transaction_links
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "txn_links_service_insert" ON public.transaction_links
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_org_from_jwt()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE INDEX IF NOT EXISTS txn_links_source ON public.transaction_links (source_type, source_id);
CREATE INDEX IF NOT EXISTS txn_links_target ON public.transaction_links (target_type, target_id);
CREATE INDEX IF NOT EXISTS txn_links_org ON public.transaction_links (organization_id);

-- Helper RPC for creating links (callable from edge functions via service role)
CREATE OR REPLACE FUNCTION public.link_transactions(
  p_org_id       UUID,
  p_source_type  TEXT,
  p_source_id    UUID,
  p_source_ref   TEXT,
  p_target_type  TEXT,
  p_target_id    UUID,
  p_target_ref   TEXT,
  p_link_type    TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.transaction_links
    (organization_id, source_type, source_id, source_ref, target_type, target_id, target_ref, link_type)
  VALUES
    (p_org_id, p_source_type, p_source_id, p_source_ref, p_target_type, p_target_id, p_target_ref, p_link_type)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_transactions TO authenticated;

COMMENT ON TABLE public.transaction_links IS
  'Full lifecycle audit trail: invoice submission → disbursement → collection → settlement. Query by source or target to walk the chain.';
