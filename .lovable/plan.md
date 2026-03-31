

# Fix Build Errors + Verify Invoices Flow + Sidebar Cleanup

## 1. Fix Build Errors

### A. `LenderManagement.tsx` — Schema mismatch
The code uses columns that don't exist in the DB types (`base_rate_type`, `margin_receivable_purchase`, `margin_reverse_factoring`, `margin_payable_finance`). The actual schema has `master_base_rate_type`, `master_base_rate_value`, `master_margin_pct`.

**Two-part fix:**
1. **Database migration** — Add the missing columns to `funder_relationships`: `base_rate_type`, `margin_receivable_purchase`, `margin_reverse_factoring`, `margin_payable_finance`. Also create the `reference_rates` table with RLS (public read for authenticated users). Seed initial rates (SOFR, SONIA, EURIBOR-3M, BOE, Fixed).
2. **Code** — Until types regenerate, cast `reference_rates` queries with `as any` and `funder_relationships` inserts/selects with `as any` to avoid TS errors on the new columns.

### B. `fetch-market-rates/index.ts` — Type error
Change `error.message` to `(error as Error).message` in the catch block (line 60).

### C. `supabase/config.toml` — Missing function config
Add `[functions.fetch-market-rates] verify_jwt = false`.

## 2. Sidebar Navigation Fixes

### "Verify Invoices" visibility
Currently shows for `!isAdmin && !isOriginatorAdmin && !isBroker` — too broad. Change to show only for `isBorrower` and for counterparty users (a user who has neither admin, originator, broker, nor funder roles, or explicitly has a counterparty flag).

### Section grouping
Add section labels ("Platform Admin", "Originator", "Broker", "Borrower", "Funder", "Common") as visual dividers between nav groups. This makes the flat list scannable.

### Consolidate duplicates
- Merge "Branding" and "Branding Profiles" into a single "Branding" link (the profiles page can be a tab within branding)
- Merge "Credit Committee" and "Committee Config" into a single "Credit Committee" link (config as a tab)

## 3. Borrower Invoice Verification Upload

The `invoice_acceptances` table already supports `method: "document_upload"` and has a `document_id` field. The borrower flow needs:

### A. Add verification upload to borrower invoices page
In `src/pages/borrower/Invoices.tsx`, add an action button on invoices with `acceptance_status = 'pending'` that lets the borrower:
- Upload a signed acceptance document (PDF/image from counterparty)
- Add notes explaining the evidence
- Submit creates an `invoice_acceptances` record with `method: 'document_upload'`, `status: 'pending_review'`

This requires adding `pending_review` to the `acceptance_status` enum via migration if it doesn't exist. Checking the enum values: `pending`, `accepted`, `rejected`, `expired`. We need to add `pending_review`.

### B. Operations Manager review queue
Create a new component/tab in `src/pages/originator/Invoices.tsx` (or a dedicated page) showing invoice acceptances with `method: 'document_upload'` and `status: 'pending_review'`. The ops manager can:
- View the uploaded evidence document
- Approve (sets acceptance to `accepted` and invoice `acceptance_status` to `accepted`)
- Reject with reason (sets acceptance to `rejected`, invoice stays `pending`)

### C. Route the counterparty dashboard correctly
The `/counterparty/dashboard` route currently has no role requirement. Add `requiredRoles: ["borrower", "counterparty"]` or keep it open for users whose email matches counterparty records. The sidebar link should show for both borrowers and counterparty-type users.

## 4. Test User Accounts

The `setup-test-users` edge function creates three test accounts:
- `originator@test.vybrel.com` / `Test1234!` (originator_admin)
- `borrower@test.vybrel.com` / `Test1234!` (borrower)
- `funder@test.vybrel.com` / `Test1234!` (funder)

I'll invoke the function to verify these still work after the Cloud migration (the Supabase project ref changed from `hngzrhsigrttsqviphlb` to `dgkhnxoafvgdpqckuvei`). If they fail, I'll update the function and re-provision.

## Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration: `reference_rates` table, `funder_relationships` columns, `pending_review` enum value |
| `supabase/config.toml` | Add `fetch-market-rates` function config |
| `supabase/functions/fetch-market-rates/index.ts` | Fix type error |
| `src/pages/originator/LenderManagement.tsx` | Cast queries as `any` for new columns until types regenerate |
| `src/components/layout/DashboardLayout.tsx` | Section grouping, fix Verify Invoices visibility, consolidate duplicate links |
| `src/pages/borrower/Invoices.tsx` | Add "Upload Verification" action for pending invoices |
| `src/pages/originator/Invoices.tsx` | Add "Verification Review" tab for ops managers |

## Execution Order
1. Database migration (creates tables/columns needed by all other steps)
2. Fix `fetch-market-rates` type error + config.toml
3. Fix `LenderManagement.tsx` type casts
4. Sidebar cleanup in `DashboardLayout.tsx`
5. Borrower verification upload flow
6. Ops manager review queue
7. Test user account verification

