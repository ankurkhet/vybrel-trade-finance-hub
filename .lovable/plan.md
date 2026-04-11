

# Learning Summary & Build Error Fix Plan

## New Features from GitHub (Learned)

The external team has added significant new infrastructure across 12+ migrations:

### Offer Letters (Section 8 PRD)
- `offer_letters` table with product types, fee schedules, statuses, multi-currency support
- Sequence `OL-YYYYMMDD-NNNNN` auto-numbering
- `fee_valid_from` / `fee_valid_to` for time-based fee resolution in settlements

### Facilities Overhaul
- Extended `facilities` with `offer_letter_id`, `overall_limit`, `final_advance_rate`, validity dates, interoperability controls, overdue/platform fee pcts
- `facility_utilisation` view (real-time headroom calculation)
- `facility_funder_allocations` table — multi-funder backing per facility with full rate stack (base_rate + funder/originator/broker margins) as a `GENERATED ALWAYS` stored column
- `counterparty_sub_limits` table — per-counterparty exposure caps within facilities

### Transaction IDs & Linkage
- Sequential reference numbers on collections (`COL-`), repayments (`RPY-`), settlement advices (`SBW-`/`SFD-`), funder limits (`FL-`), journals (`JRN-`)
- `transaction_links` table for full lifecycle audit trail (REQ → DIS → DAV → COL → SBW/SFD)

### Funder Contract Terms
- Extended `funder_relationships` with scope (`all_borrowers`, `specific_borrower`, `borrower_and_counterparty`), interoperability flags, `requires_funder_approval`, `max_allocation_per_borrower`

### Bank Accounts
- `bank_accounts` table supporting originator/borrower/funder/broker actors with TrueLayer verification, immutability rules on verified accounts

### Document Acceptances & NDA
- `document_acceptances` table (immutable compliance records) for NDA, T&C, offer letter, facility letter, privacy policy
- Proxy upload support (originator/admin can record acceptance on behalf of actors)
- `brokers` table with full RLS

### Org Active Products
- `org_active_products` replaces `product_fee_configs` as product selection mechanism
- Fees now live on offer letters / facilities

### Fee Resolution Tasks
- `fee_resolution_tasks` table for when `generate-settlement` cannot resolve fees
- Manual override workflow for originator admin

### Disbursement Validation RPC
- `validate_disbursement()` function enforcing currency match, max invoice amount, facility headroom, and counterparty sub-limits

### JWT-Based RLS Overhaul
- `get_org_from_jwt()` function reads `org_id` from JWT claim with DB fallback
- All major table RLS policies rewritten to use JWT claims instead of profile joins

### PSP Tables, Immutability Rules, Standard Columns
- Various infrastructure improvements from the `20260409*` migration batch

---

## Build Errors to Fix

There are exactly two issues to resolve:

### Fix 1: `types.ts` corrupt first line
Line 1 contains `Initialising login role...` which is not valid TypeScript. This is an auto-generated file — we must NOT edit it manually. The system will regenerate it. However, the line is causing the TS1434 errors. Since this file is auto-generated, the fix is to remove the corrupt first line.

**Note:** Per project rules, we should not edit `src/integrations/supabase/types.ts`. The corrupt line was likely injected during a schema introspection. The system should auto-regenerate this file. We'll leave it for the auto-generation process.

### Fix 2: `generate-settlement/index.ts` type mismatch
The `postJournalBatch` function parameter uses `ReturnType<typeof createClient>` which doesn't match the untyped `createClient(url, key)` instance. 

**Change:** Line 127 — change the parameter type from `ReturnType<typeof createClient>` to `any`.

```typescript
// Line 127: Change
supabase: ReturnType<typeof createClient>,
// To
supabase: any,
```

This fixes all 4 TS errors (lines 130, 591, 712, 869).

---

## Summary

| Item | Action |
|------|--------|
| Learn 12+ new migrations | Done — all new tables, views, RPCs, and RLS policies understood |
| Fix `generate-settlement` type error | Change `postJournalBatch` param to `any` |
| `types.ts` corrupt line | Will be fixed by auto-regeneration (cannot manually edit) |

Single file change: `supabase/functions/generate-settlement/index.ts` line 127.

