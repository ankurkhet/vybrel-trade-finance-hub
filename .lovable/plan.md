

# Fix KYC Status: Add Originator KYC Approval with Gap Warnings

## Problem
The `kyc_completed` flag on borrowers is **never updated** anywhere in the application flow. It's only set to `true` in the test seed function. When an originator approves all documents and moves a borrower through onboarding, KYC forever shows "Pending".

## Solution

### 1. Add "Approve KYC" / "Reject KYC" button in BorrowerDetail header area
Next to the existing KYC badge, add an actionable button that lets the originator explicitly approve or reject KYC. This replaces the passive badge with an interactive control.

### 2. KYC Approval Dialog with Gap Warnings
When the originator clicks "Approve KYC", show a confirmation dialog that:
- **Checks all documents**: Lists each document type and its status (approved/pending/rejected/missing)
- **Checks validation results**: Pulls sanctions screening, bank validation, and name verification results from the borrower's metadata
- **Surfaces gaps as warnings**: Any mismatches (e.g., name doesn't match, sanctions hits, unapproved documents, missing documents) are shown as amber/red warnings
- **Requires acknowledgment**: If gaps exist, the originator must check a "I acknowledge the KYC gaps and accept the risk" checkbox before the Approve button enables
- **Notes field**: Optional text field for the originator to document their rationale

### 3. On Approval
- Set `kyc_completed = true` on the borrower record
- Log to `audit_logs` with the gaps acknowledged and the originator's notes
- If there were gaps, store them in borrower `metadata.kyc_approval` for audit trail

### 4. On Rejection  
- Set `kyc_completed = false` (keep pending)
- Optionally transition onboarding status back to `documents_requested`

## Files Modified

| File | Change |
|------|--------|
| `src/pages/originator/BorrowerDetail.tsx` | Add KYC approval button, dialog with gap analysis, `kyc_completed` update logic |

## Technical Details
- Gap analysis reads from: `documents` array (checking all doc statuses), `borrower.metadata` (for validation/sanctions results stored by ValidationResultsPanel)
- No database migration needed — `kyc_completed` boolean already exists on the `borrowers` table
- Audit log captures: gaps found, acknowledgment flag, originator notes, timestamp

