

# Comprehensive Gap Remediation Plan

This plan addresses all 25+ open gaps across 10 modules, organized into 6 implementation batches by dependency order. Each batch is a single migration + associated code changes.

---

## Batch 1 — Critical Security & Data Integrity Fixes

### 1A. Fix `funder_limits` SELECT RLS (CRITICAL)
The SELECT policy for funders currently works correctly (`funder_user_id = auth.uid()`), confirmed by inspecting live policies. **No change needed** — the reported gap appears to reference an older state that has already been corrected.

### 1B. Add `account_manager` RLS policies
The `account_manager` role exists in the enum but has zero RLS policies on any table. Add SELECT policies on: `invoices`, `borrowers`, `documents`, `facility_requests`, `credit_memos`, `disbursement_memos`, `collections`, `settlement_advices`, `counterparties`, `funder_limits`, `credit_committee_applications`. All scoped to `organization_id = get_user_organization_id(auth.uid())`.

### 1C. Fix `audit_financial_change()` trigger — reads `status` instead of `status_enum`
The `disbursement_memos` table has both `status` and `status_enum` columns. The trigger reads `OLD.status`/`NEW.status` which is the wrong column. Fix the function to read `status_enum`.

### 1D. Fix `accrue_daily_interest()` — reads JSONB path instead of numeric column
The function reads `fr.metadata->>'overdue_fee_pct'` which is always null. The actual column `facility_requests.overdue_fee_pct` exists as a numeric. Update the function to join and read the column directly. Also add an audit log entry for each accrual.

**Migration:** 1 SQL file (4 changes)
**Edge functions:** None

---

## Batch 2 — Credit Committee & Voting Fixes

### 2A. Allow vote revision before quorum
Drop the unique constraint `credit_committee_votes_application_id_user_id_key` and replace with an upsert-friendly approach: add an UPDATE policy so CC members can update their own existing votes, and change the INSERT to use `ON CONFLICT (application_id, user_id) DO UPDATE`.

### 2B. Fix `expire_stale_recommendations()` filter
Currently filters `status = 'approved'` — but there is no `active` status in this table. The correct filter is indeed `'approved'` (recommendations go from approved → expired). Verify this is correct as-is. **No change needed** unless an `active` status enum exists — it does not.

### 2C. Credit memo per-product breakdown
Add a `product_limits` JSONB column to `credit_memos` to store per-product recommended limits alongside the single `recommended_limit` number. Frontend change in CreditMemoEditor to show per-product fields.

**Migration:** 1 SQL file
**Component edits:** `CreditMemoEditor.tsx`

---

## Batch 3 — Settlement & Fee Calculation Fixes

### 3A. Auto-compute `final_discounting_rate` via trigger
Create a trigger on `facility_requests` that fires on INSERT/UPDATE and calls `compute_facility_rate()` to set `final_discounting_rate = base_rate + funder_margin + originator_margin` when component values are present.

### 3B. Apply `broker_fee_pct` in settlement calculations
Update `generate-settlement` edge function's `calculateSettlement()` to include `broker_fee_pct` from `product_fee_configs` as an additional deduction line item.

### 3C. Add reconciliation check on collection confirmation
In the collections flow, validate that `collected_amount` matches `outstanding_balance + accrued_late_fees`. Add a warning (not a block) when amounts don't reconcile.

**Migration:** 1 SQL file (trigger)
**Edge function edit:** `generate-settlement/index.ts`
**Component edit:** `Collections.tsx` (reconciliation warning)

---

## Batch 4 — Fraud Module Activation & Invoice Workflow

### 4A. Deploy and wire `invoice-fraud-check` edge function
The edge function already exists in the codebase but needs to be deployed. Verify it is deployed and callable. The DB trigger `enforce_fraud_check_on_funding` already exists on `funding_offers`.

### 4B. Ensure `selectedFacilityId` is saved on invoice insert
Verify the InvoiceSubmissionWizard passes `facility_request_id` in the invoice insert. If missing, add it.

### 4C. Wire counterparty email notifications
Set up Lovable email infrastructure and update `notify-counterparty` edge function to actually send emails instead of just building HTML.

**Edge function deploy:** `invoice-fraud-check`
**Component edit:** `InvoiceSubmissionWizard.tsx` (if needed)
**Email setup:** Domain + transactional scaffolding

---

## Batch 5 — Notifications & Workflow Gaps

### 5A. Notify funder on referral creation
Add a notification insert in the `funder_referrals` audit trigger (or a new trigger) that creates a `notifications` row for the funder when a referral is created.

### 5B. Counter-offer workflow
Add originator UI in the funder limits/referrals screen to accept or reject a `counter_offered` status. Update the funder limit status and log to audit.

### 5C. Dunning escalation stages
Add `dunning_stage` column to invoices (values: `none`, `reminder`, `warning`, `escalated`, `legal`). Update `accrue_daily_interest()` to set the stage based on days overdue (1-30: reminder, 31-60: warning, 61-90: escalated, 90+: legal). Insert a notification on first overdue day.

### 5D. CC votes dual source of truth
Add a note in the CC minutes generation to read exclusively from `credit_committee_votes` table, ignoring legacy JSONB votes in minutes. No schema change — code-only fix in `credit-committee-decide` edge function.

**Migration:** 1 SQL file
**Edge function edit:** `credit-committee-decide/index.ts`
**Component edits:** Funder limits UI, Disbursements/Collections

---

## Batch 6 — Minor & Operational Gaps

### 6A. Sanctions auto-trigger on director save (minor)
Add a trigger or frontend hook that calls `registry-lookup` with sanctions capability when a `borrower_directors` row is inserted or updated. Currently manual-only.

### 6B. Re-screening on registry data changes
Out of scope for automated implementation — requires external webhook from registry providers. Document as a manual periodic process.

### 6C. Live market rate feed
The `fetch-market-rates` function hardcodes rates. Add a `FRED_API_KEY` secret check and, if present, fetch SOFR from the FRED API. Otherwise keep static fallback. This is an enhancement, not a bug.

### 6D. Workflow engine auto-trigger
Add DB triggers on key state-change tables (`invoices`, `disbursement_memos`, `credit_committee_applications`) that call the `workflow-engine` edge function via `pg_net` on status transitions.

**Migration:** 1 SQL file
**Edge function edits:** `fetch-market-rates/index.ts`

---

## Summary Table

| Batch | Items | Type | Risk | Priority |
|-------|-------|------|------|----------|
| 1 | 1B, 1C, 1D | Migration | Medium | P0 — Security + data integrity |
| 2 | 2A, 2C | Migration + component | Low | P1 — Functional |
| 3 | 3A, 3B, 3C | Migration + edge fn + component | Medium | P1 — Financial accuracy |
| 4 | 4A, 4B, 4C | Deploy + email setup | Medium | P1 — Fraud activation |
| 5 | 5A-5D | Migration + edge fn + components | Low | P2 — Operational |
| 6 | 6A, 6C, 6D | Migration + edge fn | Low | P3 — Enhancements |

**Total:** 4 migrations, 3 edge function edits, 1 edge function deploy, ~5 component edits, email infrastructure setup.

**Items confirmed already fixed or not actually broken:**
- `funder_limits` SELECT RLS (1A) — policy is correct
- `expire_stale_recommendations` filter (2B) — `approved` is the correct status
- `invoice-fraud-check` edge function exists in codebase (just needs deploy)
- Payment initiation via TrueLayer (out of scope — requires bank integration contract)

