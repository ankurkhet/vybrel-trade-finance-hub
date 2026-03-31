

# Multi-Funder Referral, Per-Product Limits, CC Config Restore, and Cross-Tenant Fix

## Overview

The "dist upload failed" error is a transient platform issue (Nix store path missing) -- not a code bug. Retry publishing.

This plan addresses six interconnected issues:

1. **Cross-tenant funder leakage** -- funders queried by `profiles.organization_id` instead of `funder_relationships`
2. **Missing Credit Committee Configuration tab**
3. **Credit Committee voting needs per-product and/or overall limits**
4. **Multi-funder referral** -- originator can refer the same deal to multiple funders
5. **Funder visibility of other funders' approved limits** (anonymized) and counterparty scope
6. **Funder assessment with read-only MSA rates, per-product limits, scope, and counterparty linkage**

---

## Database Migration

Add per-product limit columns, scope, and counterparty_id to `funder_limits`:

```sql
ALTER TABLE public.funder_limits
  ADD COLUMN IF NOT EXISTS counterparty_id uuid REFERENCES public.counterparties(id),
  ADD COLUMN IF NOT EXISTS overall_limit numeric,
  ADD COLUMN IF NOT EXISTS limit_receivables_purchase numeric,
  ADD COLUMN IF NOT EXISTS limit_reverse_factoring numeric,
  ADD COLUMN IF NOT EXISTS limit_payable_finance numeric,
  ADD COLUMN IF NOT EXISTS scope text DEFAULT 'specific_counterparty';
-- scope: 'specific_counterparty' | 'all_counterparties'
```

The `counterparty_id` foreign key links to the `counterparties` table so utilization can be tracked against the borrower+counterparty combination. The existing `counterparty_name` remains for display; `counterparty_id` is the relational key.

---

## Step 1 -- Fix Cross-Tenant Funder Lookup

**File:** `src/pages/originator/FunderLimitsTab.tsx`

Change `fetchFunders` to query `funder_relationships` for the current `organizationId`, then join to `profiles` for display names. This ensures only funders with an active MSA with THIS originator appear.

## Step 2 -- Restore Credit Committee Configuration Tab

**File:** `src/pages/originator/CreditCommittee.tsx`

Add a 4th "Configuration" tab rendering the existing `CreditCommitteeSettings` component (from `src/components/credit-committee/Settings.tsx`). Visible to `originator_admin` only.

## Step 3 -- Credit Committee Voting with Per-Product and/or Overall Limits

**File:** `src/components/credit-committee/ApplicationDetail.tsx`

Expand the voting card to include:
- **Overall recommended limit** (optional)
- **Per-product limit inputs** (Receivables Purchase, Reverse Factoring, Payable Finance) -- each optional
- Members can approve at overall level, per-product level, or both

Vote JSON stored in `credit_committee_minutes.votes`:
```json
{
  "user_id": "...",
  "vote": "approve",
  "notes": "...",
  "overall_limit": 500000,
  "product_limits": {
    "receivables_purchase": 300000,
    "reverse_factoring": 100000,
    "payable_finance": 100000
  }
}
```

## Step 4 -- Multi-Funder Referral from Originator

**File:** `src/pages/originator/FunderLimitsTab.tsx`

Update the "Request Funder Limit" dialog to support:
- **Counterparty selector** -- dropdown from `counterparties` table (optional; blank = global borrower limit). Stores `counterparty_id` for utilization tracking.
- **Per-product requested limits** alongside overall limit
- Originator can open the dialog multiple times, selecting different funders each time -- each creates a separate `funder_limits` row. The table already supports this (no unique constraint on borrower+funder).

The limits table view shows all referred funders for this borrower, grouped by funder. Originator can see which funders have approved, rejected, or are still pending. The originator decides which funder(s) to activate.

## Step 5 -- Funder View: Anonymized Other-Funder Limits

**File:** `src/pages/funder/Marketplace.tsx`

When a funder opens the "Assess Limit" dialog:
- Query `funder_limits` for the same `borrower_id` where `status = 'approved'` and `funder_user_id != current_user`. This retrieves limits approved by other funders.
- Display as a read-only info panel: "Another funder has approved a limit of GBP X for [counterparty name / Global Borrower Limit]". No funder identity revealed.
- If multiple other funders exist, list each as "Funder A: GBP X (Specific Counterparty: ABC Ltd)", "Funder B: GBP Y (All Counterparties)" -- using generic labels, not names.

## Step 6 -- Funder Assessment: Per-Product Limits, Scope, Read-Only Rates

**File:** `src/pages/funder/Marketplace.tsx`

Replace the single "Approved Limit Amount" input with:
- **Overall limit** input
- **Per-product limit inputs** (Receivables Purchase, Reverse Factoring, Payable Finance)
- **Scope selector**: "Specific counterparty (as stated)" vs "All counterparties for this borrower"
- **MSA rates (read-only)**: Fetch from `funder_relationships` for this org and display base rate type + margin as disabled fields with "Governed by Master Service Agreement" label. Funder cannot change rates at deal level.

On approve: write `overall_limit`, per-product limits, `scope`, and `counterparty_id` to `funder_limits`. The existing `base_rate_type` and `margin_pct` are NOT editable -- they come from the MSA.

Internal originator pricing (originator fee, platform fee) remains hidden from the funder view.

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/` | Add `counterparty_id`, per-product limit columns, `scope` to `funder_limits` |
| `src/pages/originator/FunderLimitsTab.tsx` | Fix funder lookup via `funder_relationships`; counterparty dropdown; per-product limits in referral; multi-funder support |
| `src/pages/originator/CreditCommittee.tsx` | Add Configuration tab |
| `src/components/credit-committee/ApplicationDetail.tsx` | Per-product and/or overall limit inputs in voting |
| `src/pages/funder/Marketplace.tsx` | Per-product limits, scope selector, read-only MSA rates, anonymized other-funder limits panel |

## Execution Order
1. Database migration
2. Fix cross-tenant funder lookup
3. Restore CC Configuration tab
4. CC voting with per-product/overall limits
5. Multi-funder referral dialog with counterparty selector
6. Funder assessment with anonymized peer limits, per-product inputs, scope, read-only rates

