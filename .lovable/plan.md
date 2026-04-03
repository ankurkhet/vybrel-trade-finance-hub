

# Gap Validation & Remediation Plan — Credit Pipeline Stages 2-5 + Additional

## Validation Summary

I verified every claim against the live database. Here are the results:

### Stage 2 — Credit Committee (55%): ALL CONFIRMED
- No FK between `credit_committee_applications` and `credit_memos` — **TRUE**
- `type` is free text, no enum — **TRUE**
- Votes stored as JSONB array, not individual rows — **TRUE**
- `status` is free text, no transition trigger — **TRUE**
- `parent_application_id` has no parent-state validation — **TRUE**

### Stage 3 — Limit Recommendation (20%): CONFIRMED MISSING
- No `credit_limit_recommendations` table — **TRUE**
- No `funder_referrals` table — **TRUE**
- No structured CC output flowing to funder stage — **TRUE**

### Stage 4 — Funder Review (25%): MOSTLY CONFIRMED
- No FK between `funder_limits` and referral — **TRUE**
- No approval workflow/trigger on `funder_limits` — **TRUE**
- No counter-offer field — **TRUE**
- No `valid_from`/`valid_to` — **TRUE**
- RLS uses `profiles.id` — **FALSE** (correctly uses `funder_user_id = auth.uid()`)

### Stage 5 — Invoice Eligibility (60%): CONFIRMED
- `check_funder_eligibility` checks `status = 'active'` but values are pending/approved/rejected — **TRUE** (bug)
- No counterparty sub-limit check — **TRUE**
- `handleSubmit` in InvoiceSubmissionWizard does zero eligibility calls — **TRUE** (confirmed lines 227-308)
- No validity date check — **TRUE**

### Additional Gaps
- Help Centre incomplete — **PARTIALLY FALSE** (robust HelpCentreContent.tsx exists with search, role filtering, PDF export — but could be richer)
- Sanctions not auto-triggered for directors — **TRUE**
- TrueLayer stops at name verify — **TRUE**
- No auto eligibility check on invoice submit — **TRUE**
- No rate limiting/error monitoring — **TRUE**
- CC votes still JSONB — **TRUE**
- No auto-rescreen of approved borrowers — **TRUE**

---

## Remediation Plan

### Step 1: CC Application Hardening (Migration)
- Create `application_type` enum (new_facility, limit_increase, limit_renewal, counterparty_limit, facility_addition) and convert column
- Add `credit_memo_id UUID` FK column
- Create status transition trigger (draft → submitted → under_review → approved/rejected/deferred)
- Add parent-state validation trigger

### Step 2: Structured Voting Table (Migration)
- Create `credit_committee_votes` table with individual auditable rows (application_id, user_id, vote enum, conditions_text, product_limits JSONB, voted_at)
- RLS scoped by organization via application lookup
- Update `credit-committee-decide` edge function to read from new table (backward-compatible with existing JSONB)

### Step 3: Limit Recommendations + Funder Referrals (Migration)
- Create `credit_limit_recommendations` (application_id, borrower_id, org_id, overall/RP/RF/PF limits, risk_grade, recommended_rate, valid_from/to, status)
- Create `funder_referrals` (recommendation_id, funder_user_id, org_id, referred limits, status enum [referred → under_review → approved → rejected → counter_offered], funder_approved_amount, funder_notes)
- Add `referral_id` FK to `funder_limits`
- Add `valid_from`/`valid_to` to `funder_limits`
- RLS policies for both new tables

### Step 4: Funder Limit Workflow (Migration)
- Add `funder_approved_amount`, `approval_notes` to `funder_limits`
- Create status transition trigger (pending → approved/rejected/suspended)

### Step 5: Fix Eligibility Function (Migration)
- Change `status = 'active'` to `status = 'approved'` in `check_funder_eligibility`
- Add counterparty-level sub-limit check
- Add validity date check

### Step 6: Update credit-committee-decide Edge Function
- Read votes from new `credit_committee_votes` table
- Auto-create `credit_limit_recommendation` record on approval

### Step 7: Invoice Eligibility in UI
- Call `check_funder_eligibility` RPC before insert in `InvoiceSubmissionWizard.handleSubmit`
- Show available limit and block if exceeded

### Step 8: Auto-Screening on Director Save
- After saving a director in `DirectorsStep.tsx`, auto-invoke sanctions screening
- Display pass/fail inline

### Step 9: Refactor ReferToFunderDialog
- Create `funder_referrals` record instead of directly inserting `funder_limits`
- Full audit chain: CC Application → Recommendation → Referral → Funder Limit

### Deferred (separate workstreams)
- TrueLayer payment initiation — requires commercial API agreement
- Rate limiting / error monitoring — infrastructure concern
- Auto-rescreen of approved borrowers — scheduled job design needed

