
-- ============================================================
-- BATCH 2: Credit Committee & Voting Fixes
-- ============================================================

-- ---- 2A: Allow vote revision ----

-- Drop existing unique constraint if it exists, recreate to allow upsert
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'credit_committee_votes_application_id_user_id_key'
  ) THEN
    ALTER TABLE public.credit_committee_votes DROP CONSTRAINT credit_committee_votes_application_id_user_id_key;
  END IF;
END
$$;

-- Re-add as a unique index (supports ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS credit_committee_votes_app_user_unique
ON public.credit_committee_votes (application_id, user_id);

-- Add UPDATE policy so CC members can revise their own votes
CREATE POLICY "cc_members_can_update_own_votes"
ON public.credit_committee_votes FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
);

-- ---- 2C: Add product_limits JSONB to credit_memos ----

ALTER TABLE public.credit_memos
ADD COLUMN IF NOT EXISTS product_limits jsonb DEFAULT NULL;

COMMENT ON COLUMN public.credit_memos.product_limits IS 'Per-product recommended limits, e.g. {"receivables_purchase": 500000, "reverse_factoring": 300000, "payables_finance": 200000}';
