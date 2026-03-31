

# Show Borrower Name Instead of "Credit Memo" in Credit Committee Applications

## Problem
All applications in the Credit Committee page show generic labels. The borrower name should be displayed so users can identify which application relates to which borrower.

## Changes

### File: `src/components/credit-committee/Applications.tsx`

1. **Update the query** (line 46) to join borrower data:
   ```
   .select("*, borrowers(company_name)")
   ```

2. **Add a "Borrower" column** to the table header (between Application # and Type)

3. **Display borrower name** in the table body using `app.borrowers?.company_name || app.debtor_name || "—"` — falls back to `debtor_name` if no borrower is linked

This is a single-file change with no migration needed since `borrower_id` already references `borrowers`.

