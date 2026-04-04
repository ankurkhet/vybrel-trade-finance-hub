

# Validated Gap Report & Remediation Plan

## Validation Results

### CONFIRMED BUGS (must fix)

| # | Claim | Verdict | Detail |
|---|-------|---------|--------|
| 1 | **Eligibility check passes borrower's userId as funder_user_id** | **TRUE — CRITICAL** | Line 239 of `InvoiceSubmissionWizard.tsx` passes logged-in user's ID. The function needs the actual funder's ID from the facility/limit record, not the submitter. |
| 2 | **No `facility_request_id` stored on invoice** | **TRUE** | Column doesn't exist on `invoices` table. Insert at line 269 never sets it. |
| 3 | **No `approved_by`/`approved_at` on `funder_limits`** | **TRUE** | Confirmed missing from schema. Maker-checker audit incomplete. |
| 4 | **RLS on `funder_limits` uses `profiles.id = auth.uid()`** | **PARTIALLY TRUE** | Uses `WHERE id = auth.uid() OR user_id = auth.uid()` — the `id` check is wrong (profiles.id is a separate UUID from auth.uid()), but the `OR user_id` clause saves it. Still should be cleaned up. |
| 5 | **No audit triggers on `funding_offers` or `funder_referrals`** | **TRUE** | Previous sprint only added triggers on disbursement_memos, settlement_advices, collections. |

### CONFIRMED MISSING FEATURES

| # | Claim | Status |
|---|-------|--------|
| 6 | No notification when funder_referral is created | TRUE |
| 7 | Counter-offer workflow (`counter_offered` status) has no UI/logic | TRUE |
| 8 | Market rates still hardcoded in fetch-market-rates | TRUE |
| 9 | No DB-level trigger preventing direct insert into funding_offers | TRUE |
| 10 | No expiry automation on credit_limit_recommendations.valid_to | TRUE |

### ALREADY FIXED / FALSE CLAIMS

| Claim | Verdict |
|-------|---------|
| CC votes have no UNIQUE constraint on (application_id, user_id) | **FALSE** — constraint exists |
| Help Centre is incomplete / no /help route | **FALSE** — /help route exists with HelpCentreContent.tsx, search, role filtering, PDF export |
| Sanctions screening not auto-triggered on director save | **FALSE** — `DirectorsStep.tsx` already has `runSanctionsScreening()` wired to a screening button |

---

## Remediation Plan

### Step 1: Fix eligibility check architecture (Critical)

**Migration:**
- Add `facility_request_id UUID` column to `invoices` table

**InvoiceSubmissionWizard.tsx:**
- When a facility is selected, look up the associated funder from `funder_limits` (via `facility_requests.borrower_id` + org match)
- Pass the actual `funder_user_id` from the matched `funder_limits` record to `check_funder_eligibility`
- Store `facility_request_id` on the invoice insert
- If no funder limit exists for the facility, skip the check gracefully (borrower-submitted invoices without funder assignment)

### Step 2: Add maker-checker fields to funder_limits

**Migration:**
- Add `approved_by UUID`, `approved_at TIMESTAMPTZ` to `funder_limits`
- Update the existing status transition trigger to auto-populate these on approval

### Step 3: Clean up funder_limits RLS

**Migration:**
- Replace `WHERE id = auth.uid() OR user_id = auth.uid()` with just `WHERE user_id = auth.uid()` across all three funder_limits policies

### Step 4: Add audit triggers on funding_offers and funder_referrals

**Migration:**
- Reuse existing `audit_financial_change()` trigger function
- Attach to `funding_offers` and `funder_referrals` tables

### Step 5: Funder referral notification

**Migration or code:**
- After inserting a `funder_referrals` row (in `ReferToFunderDialog.tsx`), insert a notification into `notifications` table for the target funder user

### Step 6: Credit limit recommendation expiry automation

**Migration:**
- Create a simple SQL function `expire_stale_recommendations()` that updates status to 'expired' where `valid_to < CURRENT_DATE AND status = 'approved'`
- Schedule via pg_cron (with graceful fallback if extension unavailable)

---

## Deferred Items (not actionable now)

- **Counter-offer workflow UI** — needs UX design decisions first
- **Market rates live API** — requires FRED_API_KEY or similar; currently acceptable with manual override
- **DB trigger on funding_offers insert** — complex; requires knowing which funder to validate against at bid time
- **Sanctions auto-trigger** — already exists as manual button; auto-on-save is a UX preference, not a gap

## Effort: 2 migrations, 1 component edit, 1 dialog edit. No edge function changes needed.

