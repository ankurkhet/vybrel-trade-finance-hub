

# Fraud Management & Duplicate Invoice Validation Module

## Overview

This plan adds a complete fraud detection layer to the invoice lifecycle: a new `invoice_fraud_checks` table, an AI-powered edge function that runs duplicate detection + rule-based scoring + optional external API calls, frontend integration at submission and review screens, ops manager override workflow, and admin configuration via the existing Registry API module.

---

## Architecture

```text
Borrower submits invoice
        │
        ▼
┌──────────────────────┐
│ InvoiceSubmissionWizard │
│  (live duplicate check  │
│   on invoice_number)    │
└────────┬─────────────┘
         ▼
┌──────────────────────┐
│ invoice-fraud-check  │   ← Edge Function
│  edge function       │
│  ┌─ Duplicate scan   │
│  ├─ Rule engine      │
│  ├─ AI tamper check  │
│  └─ External APIs    │
│     (MonetaGo etc.)  │
└────────┬─────────────┘
         ▼
┌──────────────────────┐
│ invoice_fraud_checks │   ← New table
│ (score, status,      │
│  reasons, details)   │
└────────┬─────────────┘
         ▼
  score < threshold → passed (green badge)
  score 40-threshold → flagged (amber) → ops review
  score ≥ threshold → blocked (red) → ops override required
```

---

## Step 1: Database Migration

### New table: `invoice_fraud_checks`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| invoice_id | uuid FK → invoices | |
| organization_id | uuid FK → organizations | |
| fraud_score | numeric(5,2) | 0-100 |
| status | enum (passed, flagged, blocked) | |
| duplicate_matches | jsonb | Array of matched invoice IDs with reasons |
| rule_results | jsonb | Array of rule check results |
| ai_signals | jsonb | Tampering indicators from AI |
| external_results | jsonb | Results from external APIs (MonetaGo etc.) |
| reasons | text[] | Human-readable list of reasons |
| checked_at | timestamptz | |
| checked_by | uuid | User who triggered |
| override_by | uuid NULL | Ops manager who overrode |
| override_at | timestamptz NULL | |
| override_reason | text NULL | |
| created_at | timestamptz | |

### New columns on `invoices`
- `fraud_score` numeric NULL
- `fraud_status` text NULL DEFAULT 'pending' (pending, passed, flagged, blocked, overridden)

### New columns on `organization_settings`
- `fraud_threshold` numeric DEFAULT 70
- `fraud_providers_enabled` jsonb DEFAULT '[]'

### RLS policies on `invoice_fraud_checks`
- SELECT: org members can read their org's checks
- INSERT: service role only (via edge function, SECURITY DEFINER)
- UPDATE: only ops managers can update (for overrides) — check `has_role(auth.uid(), 'originator_admin')`
- DELETE: denied (immutable audit trail)

### Trigger on `funding_offers`
- Extend existing `enforce_funder_eligibility_on_insert` or add new `enforce_fraud_check_on_funding` trigger
- Before INSERT: look up `invoices.fraud_status` — if `blocked`, raise exception; if `flagged` and no override exists, raise exception

---

## Step 2: Edge Function — `invoice-fraud-check`

New edge function that accepts `{ invoice_id, organization_id, invoice_data }` and returns a structured fraud assessment.

### Check pipeline:
1. **Duplicate Detection** — Query `invoices` table within the same organization:
   - Exact match on `invoice_number` + `debtor_name` (different invoice ID)
   - Fuzzy match: same `debtor_name` + amount within ±5% + date within 7 days
   - Same `invoice_number` across any borrower in the org
   - Score: exact duplicate = 90, fuzzy = 50-70

2. **Rule-Based Checks** — Configurable rules:
   - Amount vs. borrower's historical average (flag if >3x average)
   - Rapid successive invoices (>5 invoices from same debtor in 7 days)
   - Supplier concentration (>80% of total from single debtor)
   - Round-number amounts (exact thousands)
   - Weekend/holiday-dated invoices
   - Each rule contributes 5-20 points to score

3. **AI Document Analysis** — Call existing `ai-analyze-document` patterns:
   - Check for digital tampering indicators (metadata inconsistencies, font changes)
   - Cross-reference extracted data vs. submitted form data
   - Contributes 10-30 points if suspicious

4. **External API Checks** — Query `registry_api_configs` for entries with capability `fraud_detection`:
   - If MonetaGo or similar is configured and active, call their API
   - Results merged into score
   - Graceful fallback if external API is unavailable

5. **Score Aggregation** — Weighted combination, capped at 100:
   - Return `{ score, status, reasons[], duplicate_matches[], rule_results, ai_signals, external_results }`
   - Status: score < 40 = passed, 40-threshold = flagged, ≥threshold = blocked

6. **Persist** — Insert into `invoice_fraud_checks` and update `invoices.fraud_score` + `invoices.fraud_status`

7. **Audit** — Log to `audit_logs` with action `fraud_check`

---

## Step 3: Frontend — InvoiceSubmissionWizard Changes

### Live duplicate warning (Step "review")
- On `invoiceNumber` blur/change: query `invoices` table for same `invoice_number` + `organization_id`
- If match found: show amber banner "Duplicate invoice number detected — INV-123 already exists for [debtor]"
- This is a fast client-side check, not the full fraud scan

### On submit (before insert)
- Call `invoice-fraud-check` edge function with the form data
- If `status === 'blocked'`: show red `AlertCircle` banner with all reasons, block submit entirely
- If `status === 'flagged'`: show amber warning with reasons, allow submit but invoice is created with `fraud_status = 'flagged'`
- If `status === 'passed'`: proceed normally
- Show a fraud risk meter (progress bar 0-100) with color coding

### New state variables
- `fraudResult` — stores the edge function response
- `fraudChecking` — loading state during check

---

## Step 4: Frontend — Originator Invoices.tsx Changes

### Table column
- Add "Fraud" column between "Status" and "Acceptance"
- Render `FraudBadge` component: green shield (passed), amber shield (flagged), red shield (blocked), grey (pending)
- Tooltip on hover shows reasons array

### Detail dialog
- New "Fraud Assessment" section with:
  - Score gauge (0-100 with color)
  - Reasons list
  - Duplicate matches (linked invoice numbers)
  - Override button (visible only to ops managers when status is flagged/blocked)

### Override workflow
- Ops manager clicks "Override" → confirmation dialog with required reason text
- Updates `invoice_fraud_checks` with `override_by`, `override_at`, `override_reason`
- Updates `invoices.fraud_status` to `overridden`
- Logs to `audit_logs`
- Sends notification to borrower: "Your invoice INV-XXX has been reviewed and cleared"

### Stats row
- Add "Flagged" count to the stats bar

---

## Step 5: Frontend — Borrower Portal Updates

### Borrower Invoices page
- Show fraud status badge on each invoice row
- If `blocked` or `flagged`: show banner with reason + "Upload additional documents" button
- Upload button opens a document upload dialog linked to the invoice
- On upload: notify ops manager via `notifications` table
- Borrower can see messages from ops manager about the investigation via the existing Messages system

---

## Step 6: Admin Configuration — Registry API Module

### Fraud Providers section in RegistryApis.tsx
- Add a new card/section "Fraud Detection Providers" below existing registry configs
- Seed recommended providers:
  - **MonetaGo** — Invoice duplication/fraud registry (API: `https://api.monetago.com/v1/check`, capability: `fraud_detection`)
  - **Coface** — Trade credit insurance & fraud signals
  - **Atradius** — Buyer risk assessment
  - **Dun & Bradstreet** — Supplier risk scores
- Admin can add custom fraud API providers using the same registry config pattern (URL, API key, capabilities)

### Threshold configuration
- In `organization_settings` admin section: add "Fraud Score Threshold" slider (0-100, default 70)
- Toggle to enable/disable fraud checking globally

---

## Step 7: Messaging for Investigation

- When ops manager reviews a flagged/blocked invoice, they can send a message to the borrower via the existing Messages system using `related_entity_type: 'invoice'` and `related_entity_id: invoice.id`
- Borrower sees the message thread on their invoice detail view
- This reuses the existing `messages` table — no new infrastructure needed

---

## Technical Summary

| Component | Type | Files |
|-----------|------|-------|
| `invoice_fraud_checks` table + columns + RLS + trigger | Migration | 1 SQL |
| `invoice-fraud-check` edge function | New edge function | 1 file |
| InvoiceSubmissionWizard fraud integration | Component edit | 1 file |
| Originator Invoices fraud badges + override | Component edit | 1 file |
| Borrower Invoices fraud status + upload | Component edit | 1 file |
| Registry API fraud providers section | Component edit | 1 file |
| `registry_api_configs` capability: `fraud_detection` seed | Migration | included in step 1 |

**Estimated effort:** ~45 minutes across 1 migration, 1 new edge function, 4 component edits.

**Recommended API providers for fraud detection:**
- MonetaGo (invoice registry — prevents double-financing across lenders)
- Coface (trade credit risk)
- Atradius (buyer/supplier risk)
- Dun & Bradstreet (business verification + risk scoring)
- Creditsafe (company credit reports)

