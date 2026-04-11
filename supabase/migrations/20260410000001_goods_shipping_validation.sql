-- ============================================================
-- Goods / Shipping Validation
-- Optional workflow: triggered when borrower uploads shipping
-- documents (bill of lading, packing list, customs declaration).
-- Account manager can manually confirm goods if no docs uploaded.
-- ============================================================

-- 1. Add shipping validation columns to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS goods_verified_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS goods_verified_by          UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS shipping_validation_status TEXT DEFAULT 'not_required'
    CHECK (shipping_validation_status IN ('not_required', 'pending', 'ai_flagged', 'verified')),
  ADD COLUMN IF NOT EXISTS shipping_ai_result         JSONB;
  -- shipping_ai_result shape:
  -- {
  --   matched: boolean,
  --   confidence: number,          -- 0-100
  --   mismatches: [{ field, invoice_value, doc_value }],
  --   extracted_description: string,
  --   extracted_quantity: number,
  --   extracted_total_value: number
  -- }

COMMENT ON COLUMN public.invoices.shipping_validation_status IS
  'not_required = no shipping docs uploaded; pending = docs uploaded, AI processing;
   ai_flagged = mismatches detected; verified = goods confirmed';
COMMENT ON COLUMN public.invoices.goods_verified_by IS
  'Account manager who manually confirmed goods when no shipping docs were uploaded';

-- 2. Flag shipping documents within invoice_submission_documents
ALTER TABLE public.invoice_submission_documents
  ADD COLUMN IF NOT EXISTS is_shipping_doc BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.invoice_submission_documents.is_shipping_doc IS
  'True for bill_of_lading, packaging_slip, customs_declaration uploads';
