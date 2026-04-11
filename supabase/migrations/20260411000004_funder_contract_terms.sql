-- ============================================================
-- PRD Section 8: Extend Funder Relationships (Contract Terms)
-- Adds scope, interoperability, funder approval gate, and
-- max allocation cap to the MSA record.
-- ============================================================

ALTER TABLE public.funder_relationships
  ADD COLUMN IF NOT EXISTS scope                      TEXT NOT NULL DEFAULT 'all_borrowers'
    CHECK (scope IN ('all_borrowers', 'specific_borrower', 'borrower_and_counterparty')),
  ADD COLUMN IF NOT EXISTS borrower_id                UUID REFERENCES public.borrowers(id),
    -- Non-null when scope = 'specific_borrower' or 'borrower_and_counterparty'
  ADD COLUMN IF NOT EXISTS counterparty_id            UUID,
    -- Non-null when scope = 'borrower_and_counterparty'
  ADD COLUMN IF NOT EXISTS interoperability_allowed   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interoperability_max_pct   NUMERIC(5, 2) DEFAULT 0,
    -- Max % of invoice value that can be cross-currency funded
  ADD COLUMN IF NOT EXISTS requires_funder_approval   BOOLEAN NOT NULL DEFAULT false,
    -- If true, each facility_funder_allocation needs funder_approved_at before becoming active
  ADD COLUMN IF NOT EXISTS max_allocation_per_borrower NUMERIC(20, 6);
    -- Hard cap on total allocated_limit across all facility_funder_allocations for a single borrower

COMMENT ON COLUMN public.funder_relationships.scope IS
  'Governs which borrowers/counterparties this MSA covers: all_borrowers, specific_borrower, or borrower_and_counterparty';
COMMENT ON COLUMN public.funder_relationships.interoperability_allowed IS
  'Whether the funder will fund invoices in a currency different from the facility currency';
COMMENT ON COLUMN public.funder_relationships.requires_funder_approval IS
  'If true, facility_funder_allocations under this MSA require funder_approved_at before becoming active';
COMMENT ON COLUMN public.funder_relationships.max_allocation_per_borrower IS
  'Hard cap in GBP equivalent on total funder exposure to any single borrower';
