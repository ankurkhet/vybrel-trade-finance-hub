

# Add "Refer to Funder" Button on Approved CC Applications

## Problem
After the Credit Committee approves a credit limit, there is no direct action on the CC Application Detail page to refer it to a funder. The originator admin must manually navigate to the Borrower Detail page → Funder Limits tab to do this.

## Solution
Add a "Refer to Funder" button on the CC Application Detail page that appears when the application status is **approved** and the user is an originator admin. This button opens an inline referral dialog (reusing the same logic from `FunderLimitsTab`) with limits pre-populated from the CC approval.

## Changes

### File: `src/components/credit-committee/ApplicationDetail.tsx`

1. **Add a "Refer to Funder" button** in the action sidebar, visible when `status === 'approved'` and user is originator admin
2. **Add an inline referral dialog** with:
   - Funder selector (fetched from `funder_relationships` for the application's org)
   - Counterparty selector (optional, from borrower's counterparties)
   - Per-product limit inputs pre-populated from the CC vote metadata (`approved_limits`)
   - Read-only MSA rates (base rate + margin) fetched from `funder_relationships`
3. **On submit**, insert a row into `funder_limits` with borrower_id, counterparty_id, per-product limits, scope, and MSA rates
4. The dialog can be opened multiple times to refer to different funders

No migration needed — uses existing `funder_limits` table structure.

