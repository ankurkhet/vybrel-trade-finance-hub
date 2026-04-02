# Gap Analysis Verification & Remediation Plan

## Verification Results — What's Accurate vs. Inaccurate

### Module 1: Multi-tenancy & Role Architecture (Claude says 72%)

| Gap Claimed | Verified? | Notes |
|---|---|---|
| `funder_limits` RLS uses `profiles.id = auth.uid()` — data leak | **FALSE** | Actual RLS uses `funder_user_id = auth.uid()` — correct pattern, no leak |
| Duplicate `funder_relationships` table across migrations | **TRUE** | Migration 20260329 uses `CREATE TABLE IF NOT EXISTS`, migration 20260330 uses `CREATE TABLE` — will fail on clean deploy |
| `document_templates` RLS references `user_roles.organization_id` which doesn't exist | **PARTIALLY TRUE** | The `user_roles` table has no `organization_id` column (only id, user_id, role). However, the `document_templates` table itself doesn't exist in the DB — the migration likely failed silently. So the RLS is broken AND the table is missing |
| `operations_manager` role has no RLS policies | **TRUE** | Role exists in enum but zero RLS policies reference it |

**Revised score: ~78%** — the funder_limits claim was wrong, which removes the "critical" data leak.

---

### Module 2: Borrower Onboarding & KYB (Claude says 82%)

| Gap Claimed | Verified? | Notes |
|---|---|---|
| `fetch_market_rates` uses hardcoded rates | **TRUE** | Edge function has hardcoded SOFR=5.31, SONIA=5.20, etc. |
| Facility approved amounts not propagated to invoice submission | **TRUE** | `facility_requests` has no `final_discounting_rate` or rate columns — only `amount_requested`, `approved_amount`, `tenor` |
| No enforcement that borrower needs approved facility before invoice | **TRUE** | No DB-level check exists |

**Score accurate at ~82%.**

---

### Module 3: Rate Matrix & Pricing (Claude says 55%)

| Gap Claimed | Verified? | Notes |
|---|---|---|
| No Postgres function for rate cascade | **TRUE** | No function computes funder base + margin = cost |
| `facility_requests` has no `final_discounting_rate` column | **TRUE** | Column does not exist. The table has no rate/discount columns at all |
| Broker fee not modelled | **TRUE** |
| `overdue_fee_pct` never set during approval | **PARTIALLY TRUE** | Column exists on `facility_requests` per migration but the table currently shows no such column in live schema — likely the column migration also failed or was on a different table |

**Score accurate at ~55%.**

---

### Module 4: Invoice Submission & Eligibility (Claude says 60%)

| Gap Claimed | Verified? | Notes |
|---|---|---|
| No funder limit check during invoice submission | **TRUE** |
| No concentration/exposure check | **TRUE** |
| Invoice status not an enum | **TRUE** | `status` is free text |
| Counterparty notification doesn't send email | **TRUE** | No email provider configured |

**Score accurate at ~60%.**

---

### Module 5: Funder Onboarding & Limits (Claude says 65%)

| Gap Claimed | Verified? | Notes |
|---|---|---|
| Duplicate `funder_relationships` + `funder_kyc` across migrations | **TRUE** | Both confirmed duplicated |
| No auto-rate copy from relationship to limits | **TRUE** |
| No funder_limits check before marketplace bid | **TRUE** |

**Score accurate at ~65%.**

---

### Module 6: Settlement & Disbursement Engine (Claude says 35%)

| Gap Claimed | Verified? | Notes |
|---|---|---|
| No disbursement state machine | **TRUE** | `status` is free `text`, no transitions enforced |
| Settlement uses wrong rate | **TRUE** | `generate-settlement` reads `product_fee_configs.default_discount_rate`, never reads any facility-specific rate |
| No payment initiation | **TRUE** | TrueLayer only does name verification |
| No reconciliation layer | **TRUE** |

**Score accurate at ~35%. This is the most critical area.**

---

### Module 7: Audit Trail (Claude says 45%)

| Gap Claimed | Verified? | Notes |
|---|---|---|
| Audit logs not immutable — no DELETE prevention | **TRUE** | No DELETE policy exists but also no explicit deny. Since no SELECT-only restriction, and no triggers prevent deletion, a service role or admin could delete |
| No triggers on financial tables | **TRUE** |
| Dunning has no audit entry | **TRUE** |

**Score accurate at ~45%.**

---

### Module 8: Workflow Engine (Claude says 78%)

| Gap Claimed | Verified? | Notes |
|---|---|---|
| No auto-trigger from table changes | **TRUE** | Workflow engine is call-based only |
| Email notifications not wired | **TRUE** |

**Score accurate at ~78%.**

---

### Module 9: Dunning & Collections (Claude says 58%)

| Gap Claimed | Verified? | Notes |
|---|---|---|
| pg_cron migration uses RAISE EXCEPTION | **TRUE** | Will abort entire migration if pg_cron not enabled |
| Dunning references missing columns | **WORSE THAN CLAIMED** | `invoices.accrued_late_fees` and `invoices.last_dunning_date` do NOT exist in the live schema. The dunning function will silently fail on every run |
| No escalation stages | **TRUE** |

**Revised score: ~45%** — worse than Claude estimated because the dunning function is completely non-functional.

---

## Remediation Plan — Prioritized by Impact

### Priority 1: Critical (Blocks Production)

**1a. Fix duplicate table migrations**
- Wrap `funder_relationships` (20260330) and `funder_kyc` (20260330) in `CREATE TABLE IF NOT EXISTS` or drop the duplicate definitions
- Single migration to reconcile

**1b. Add missing dunning columns to `invoices`**
- Add `accrued_late_fees NUMERIC DEFAULT 0` and `last_dunning_date DATE` to invoices table
- Without this, the daily cron function errors silently every night

**1c. Fix `document_templates` table + RLS**
- Recreate table (migration failed) with correct RLS using `get_user_organization_id()` instead of querying `user_roles.organization_id`

**1d. Fix pg_cron migration**
- Replace `RAISE EXCEPTION` with `RAISE NOTICE` + skip scheduling gracefully

### Priority 2: High (Financial Accuracy)

**2a. Add rate columns to `facility_requests`**
- Add `final_discounting_rate`, `advance_rate`, `overdue_fee_pct`, `funder_base_rate`, `funder_margin`, `originator_margin` columns

**2b. Fix `generate-settlement` to use facility rate**
- Modify edge function to look up `facility_requests.final_discounting_rate` via the `disbursement_memos` join, falling back to `product_fee_configs` only if no facility exists

**2c. Add disbursement state machine**
- Create enum `disbursement_status` with enforced transitions (draft → pending_approval → approved → disbursed → cancelled)
- Add validation trigger on `disbursement_memos` to enforce transitions

### Priority 3: Medium (Operational Integrity)

**3a. Add funder limit validation on invoice submission**
- Create a DB function `check_funder_eligibility(invoice_id, funder_user_id)` that validates limits

**3b. Add audit triggers on financial tables**
- Create a generic audit trigger function and attach to `disbursement_memos`, `repayment_memos`, `settlement_advices`, `collections`

**3c. Make audit_logs append-only**
- Add explicit DENY policy for DELETE and UPDATE on `audit_logs`

**3d. Add `operations_manager` RLS policies**
- Add SELECT + limited UPDATE policies on relevant financial tables

### Priority 4: Lower (Enhancement)

**4a. Broker fee modelling** — Add `broker_fee_pct` to fee config
**4b. Dunning escalation stages** — Add notification triggers at 7/30/60/90 day thresholds
**4c. Invoice status enum** — Convert free text to proper enum
**4d. Concentration checks** — Add exposure calculation function
**4e. Wire email provider** — Configure email sending for counterparty notifications

---

## Estimated Effort

| Priority | Items | Migrations | Edge Function Changes | UI Changes |
|---|---|---|---|---|
| P1 Critical | 4 | 3 migrations | 0 | 0 |
| P2 High | 3 | 2 migrations | 1 edge function | 1-2 forms |
| P3 Medium | 4 | 3 migrations | 0 | 0 |
| P4 Lower | 5 | 3 migrations | 1 edge function | 2-3 pages |

I recommend tackling P1 and P2 together as a single sprint, then P3, then P4.