

# Gap Analysis Verification & Remediation Plan

## Accuracy Assessment

I verified every claim against the live database schema and actual migration files. Here's what's accurate and what's not.

### Corrections to Claude's Analysis

| Claimed Gap | Verdict | Detail |
|---|---|---|
| **`funder_limits` RLS uses `profiles.id` instead of `profiles.user_id`** — data leak | **FALSE** | Actual RLS uses `funder_user_id = auth.uid()` directly. No data leak exists. |
| **Dunning score 58%** | **WORSE — closer to 45%** | `invoices.accrued_late_fees` and `invoices.last_dunning_date` columns do **not exist** in the live schema. The cron function silently fails every night. |
| **`document_templates` RLS silently fails** | **WORSE** | The entire `document_templates` table does not exist in the live DB — the migration itself failed (likely due to the `user_roles.organization_id` reference). |
| **`facility_requests` has `final_discounting_rate`** | **FALSE** | This column does not exist. The table has no rate/discount columns at all — only `amount_requested`, `approved_amount`, `tenor_months`, and `metadata`. |

### Confirmed Accurate Gaps

- Duplicate `funder_relationships` table (20260329 vs 20260330) — **TRUE**, will break clean deploy
- Duplicate `funder_kyc` table (20260330 two files) — **TRUE**
- `operations_manager` role has zero RLS policies — **TRUE**
- `disbursement_memos.status` is free text, no state machine — **TRUE**
- `generate-settlement` uses `product_fee_configs.default_discount_rate` only — **TRUE**
- `audit_logs` has no DELETE/UPDATE prevention — **TRUE**
- No audit triggers on financial tables — **TRUE**
- No funder limit check during invoice submission — **TRUE**
- No email provider wired for notifications — **TRUE**
- pg_cron migration uses `RAISE EXCEPTION` — **TRUE**, blocks migration chain
- Hardcoded rates in `fetch-market-rates` — **TRUE**
- No broker fee model — **TRUE**

---

## Remediation Plan — Ordered by Impact

### Sprint 1: Critical (Blocks Production)

**1. Fix duplicate table migrations**
- New migration wrapping `funder_relationships` and `funder_kyc` with `IF NOT EXISTS` guards and reconciling columns

**2. Add missing dunning columns to `invoices`**
- Add `accrued_late_fees NUMERIC DEFAULT 0` and `last_dunning_date DATE` — without these the nightly cron is non-functional

**3. Recreate `document_templates` table**
- Correct RLS to use `get_user_organization_id(auth.uid())` instead of querying non-existent `user_roles.organization_id`

**4. Fix pg_cron migration guard**
- Replace `RAISE EXCEPTION` with `RAISE NOTICE` + graceful skip

### Sprint 2: Financial Accuracy

**5. Add rate columns to `facility_requests`**
- `final_discounting_rate`, `advance_rate`, `overdue_fee_pct`, `funder_base_rate`, `funder_margin`, `originator_margin`

**6. Fix `generate-settlement` edge function**
- Look up contracted rate via `disbursement_memos` → `facility_requests`, fall back to `product_fee_configs` only when no facility exists

**7. Add disbursement state machine**
- Create `disbursement_status` enum (draft → pending_approval → approved → disbursed → cancelled)
- Validation trigger to enforce transitions + audit log entry on each change

### Sprint 3: Operational Controls

**8. Funder limit validation on invoice submission**
- DB function checking borrower/counterparty exposure against `funder_limits`

**9. Audit trail hardening**
- Append-only enforcement on `audit_logs` (deny DELETE/UPDATE)
- Generic audit trigger on `disbursement_memos`, `repayment_memos`, `settlement_advices`, `collections`

**10. `operations_manager` RLS policies**
- SELECT + limited UPDATE on financial tables (disbursements, collections, settlements)

### Sprint 4: Enhancements

**11.** Broker fee modelling — `broker_fee_pct` in fee config
**12.** Dunning escalation stages (7/30/60/90 day thresholds with notifications)
**13.** Invoice status enum conversion
**14.** Concentration/exposure calculation function
**15.** Email provider integration for counterparty notifications

---

## Effort Summary

| Sprint | Migrations | Edge Functions | UI Changes |
|---|---|---|---|
| 1 — Critical | 3 | 0 | 0 |
| 2 — Financial | 2 | 1 (generate-settlement) | 1-2 forms |
| 3 — Controls | 3 | 0 | 0 |
| 4 — Enhancements | 3 | 1 | 2-3 pages |

Recommend executing Sprints 1 and 2 together as the immediate priority.

