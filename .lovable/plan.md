
# Gap Validation & Remediation Plan — Stages 2-5 + Additional Gaps

## Validation Results

### Stage 2 — Credit Committee Workflow (55%) — All claims CONFIRMED

| Claimed Gap | Verdict | Evidence |
|---|---|---|
| No FK between `credit_committee_applications` and `credit_memos` | **TRUE** | Schema has no `credit_memo_id` column |
| Application `type` is free text — no enum | **TRUE** | Column is `text NOT NULL` with no constraint |
| Votes stored as JSONB array in `credit_committee_minutes` | **TRUE** | `votes jsonb DEFAULT '[]'` — not individual auditable rows |
| Application `status` is free text, no transition enforcement | **TRUE** | `text NOT NULL DEFAULT 'draft'` — no trigger |
| `parent_application_id` has no parent-state validation | **TRUE** | Column exists, no trigger enforcing parent = approved |

### Stage 3 — Limit Recommendation (20%) — CONFIRMED MISSING

| Claimed Gap | Verdict |
|---|---|
| No `credit_limit_recommendations` table | **TRUE** — table does not exist |
| No `funder_referrals` table | **TRUE** — table does not exist |
| No structured output from CC decision to funder stage | **TRUE** — relies on unstructured `metadata` JSONB |

### Stage 4 — Funder Review (25%) — Mostly CONFIRMED

| Claimed Gap | Verdict | Detail |
|---|---|---|
| No FK between `funder_limits` and a referral record | **TRUE** |
| No funder approval workflow/trigger | **TRUE** — status is free text |
| No counter-offer field | **TRUE** — only `limit_amount` exists |
| `funder_limits` RLS uses `profiles.id` | **FALSE** — RLS correctly uses `funder_user_id = auth.uid()` |
| No `valid_from`/`valid_to` on funder_limits | **TRUE** |

### Stage 5 — Invoice Eligibility (60%) — CONFIRMED

| Claimed Gap | Verdict | Detail |
|---|---|---|
| `check_funder_eligibility` queries `status = 'active'` but valid values are pending/approved/rejected/suspended | **TRUE** — should be `approved` not `active` |
| No counterparty-level sub-limit check | **TRUE** |
| No DB-level enforcement — direct insert bypasses checks | **TRUE** — `handleSubmit` does no eligibility call |
| No validity date check | **TRUE** — no `valid_from`/`valid_to` columns |

### Additional Gaps — Validation

| # | Gap | Verdict |
|---|---|---|
| 1 | Help Centre basic/incomplete | **PARTIALLY FALSE** — `HelpCentreContent.tsx` exists with search, role filtering, PDF export. But could be richer. |
| 2 | Sanctions screening not auto-triggered for directors | **TRUE** — no auto-call on director save |
| 3 | TrueLayer stops at name verification | **TRUE** — no payment initiation |
| 4 | No auto eligibility check on invoice submit | **TRUE** — confirmed in `handleSubmit` (line 227-308) |
| 5 | No rate limiting / error monitoring | **TRUE** — no middleware or Sentry |
| 6 | CC votes still JSONB in some flows | **TRUE** |
| 7 | No auto-rescreen of approved borrowers | **TRUE** |

---

## Remediation Plan — Prioritized

### Priority 1: Credit Pipeline Integrity (Stages 2-4)

**Migration 1 — CC Application Hardening**
- Add `credit_memo_id UUID` FK column to `credit_committee_applications`
- Create `application_type` enum (new_facility, limit_increase, limit_renewal, counterparty_limit, facility_addition)
- Add status transition trigger (draft → submitted → under_review → approved/rejected/deferred)
- Add parent-state validation trigger (parent must be approved before child created)

**Migration 2 — Structured Voting**
- Create `credit_committee_votes` table (id, application_id, user_id, vote, conditions_text, product_limits JSONB, created_at)
- Individual auditable rows per vote instead of JSONB array
- Update `credit-committee-decide` edge function to read from new table
- Keep backward-compatible read from `minutes.votes` for existing data

**Migration 3 — Limit Recommendations & Funder Referrals**
- Create `credit_limit_recommendations` table (id, application_id, borrower_id, organization_id, recommended_overall_limit, currency, limit_rp, limit_rf, limit_pf, counterparty_limits JSONB, risk_grade, recommended_rate, valid_from, valid_to, status, created_by, created_at)
- Create `funder_referrals` table (id, recommendation_id, funder_user_id, organization_id, referred_limit_amount, referred_rp/rf/pf limits, referred_rate, counterparty_scope, status enum [referred → under_review → approved → rejected → counter_offered], funder_approved_amount, funder_notes, referred_at, responded_at, created_by)
- Add `referral_id` FK to `funder_limits` for full audit trail
- Add `valid_from`/`valid_to` to `funder_limits`
- RLS policies for both tables scoped by organization_id

**Migration 4 — Funder Limit Workflow**
- Add `funder_approved_amount` (counter-offer) and `approval_notes` to `funder_limits`
- Create status transition trigger for `funder_limits` (pending → approved/rejected/suspended)

### Priority 2: Invoice Eligibility Enforcement

**Migration 5 — Fix Eligibility Function**
- Fix `check_funder_eligibility`: change `status = 'active'` to `status = 'approved'`
- Add counterparty-level sub-limit check
- Add validity date check against `valid_from`/`valid_to`

**Code Change — InvoiceSubmissionWizard.tsx**
- Call `check_funder_eligibility` RPC before insert in `handleSubmit`
- Display available limit and block submission if exceeded
- Call `get_borrower_exposure` to show concentration warning

### Priority 3: Compliance Automation

**Code Change — Director Auto-Screening**
- After saving a director in `DirectorsStep.tsx`, auto-invoke sanctions screening edge function
- Display screening results inline with pass/fail badge

### Priority 4: UI/UX Enhancements

**Code Change — ReferToFunderDialog Refactor**
- After CC approval, auto-create a `credit_limit_recommendation` record
- `ReferToFunderDialog` creates a `funder_referrals` record, which then creates the `funder_limits` entry
- Full audit chain: CC Application → Recommendation → Referral → Funder Limit

**Code Change — Funder Marketplace**
- Add referral context to funder's Marketplace view so they can approve/counter-offer

---

## Implementation Order

| Step | Scope | Type |
|---|---|---|
| 1 | CC application enum + status trigger + memo FK | Migration |
| 2 | `credit_committee_votes` table | Migration |
| 3 | `credit_limit_recommendations` + `funder_referrals` tables | Migration |
| 4 | `funder_limits` validity dates + counter-offer fields + status trigger | Migration |
| 5 | Fix `check_funder_eligibility` function | Migration |
| 6 | Update `credit-committee-decide` edge function for new votes table | Edge function |
| 7 | Invoice eligibility check in `InvoiceSubmissionWizard` | UI code |
| 8 | Auto-screening on director save | UI code |
| 9 | Refactor `ReferToFunderDialog` to use referral pipeline | UI code |

**Note:** TrueLayer payment initiation (#3), rate limiting (#5), and auto-rescreen (#7) from the additional gaps list are infrastructure-level concerns best addressed as separate workstreams after the core pipeline is complete.
