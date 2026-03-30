

# Plan: Add Screenshots with Mock Data to Help Centre

## Summary

Capture real screenshots of every key page in the running app, populated with logical mock data, and embed them into each Help Centre article.

## Phase 1: Seed Mock Data

Create a temporary seed script (edge function or direct SQL) that inserts realistic, interconnected data:

| Entity | Mock Data |
|--------|-----------|
| **Borrower** | "Wilson Trading Co" — onboarding complete, credit limit £500,000 |
| **Invoices** | 6 invoices: 2 pending (£45,000, £32,500), 1 approved (£78,200), 1 funded (£120,000), 1 settled (£55,000), 1 partially_settled (£95,000) |
| **Counterparties** | "Tesco Plc", "Sainsbury's Ltd", "Marks & Spencer Group" |
| **Contracts** | 2 active facility agreements (£250K, £500K) |
| **Directors** | 3 directors with shareholding %, DOB, nationality |
| **Documents** | Mix of approved/pending/rejected with version history |
| **Credit Memo** | AI-generated draft with risk rating and proposed limit |
| **Credit Committee** | 1 application with 2 approve votes, 1 pending |
| **Disbursement Memo** | 1 pending approval (£96,000 advance on £120K invoice) |
| **Collections** | 2 confirmed collections |
| **Funder** | "Meridian Capital Partners" — KYC approved, 1 active MSA, portfolio with 3 funded deals |
| **Fee Config** | Originator fee 1.5%, platform fee 0.5%, discount rate 3.2% |
| **Organizations** | 2 orgs: 1 approved, 1 under_review |

All numbers are internally consistent (e.g., disbursement = 80% of invoice × fees).

## Phase 2: Capture Screenshots (~25 screens)

Log in as each role via browser automation, navigate to each page, and save screenshots to `public/screenshots/`.

### Getting Started (3 screenshots)
1. `auth_role_selection.png` — Login page with 6 role cards
2. `auth_login_form.png` — Credential entry with password toggle
3. `dashboard_originator.png` — Originator dashboard with populated widgets (borrowers: 12, invoices: 47, outstanding: £1.2M, overdue ageing buckets)

### Admin (5 screenshots)
4. `admin_organizations.png` — Org list with status badges
5. `admin_org_detail.png` — Detail panel showing contacts + doc review
6. `admin_users.png` — User table with roles, filters active
7. `admin_workflow_studio.png` — Visual canvas with invoice lifecycle nodes
8. `admin_registry_apis.png` — Registry list with health indicators

### Originator (8 screenshots)
9. `orig_borrower_list.png` — Borrower table with status filters
10. `orig_borrower_detail.png` — 360° view with KYC tab active
11. `orig_credit_committee.png` — Application with votes and quorum bar
12. `orig_credit_memo.png` — AI-generated memo in editor
13. `orig_invoices.png` — Invoice table with status badges and match scores
14. `orig_disbursement.png` — Disbursement form showing fee calculations
15. `orig_collections.png` — Collections with waterfall breakdown
16. `orig_fee_config.png` — Fee configuration with payment instructions

### Borrower (5 screenshots)
17. `borr_onboarding_company.png` — Step 2 (Company Info) filled with registry auto-populate
18. `borr_onboarding_directors.png` — Step 3 with 3 directors listed
19. `borr_onboarding_documents.png` — Step 7 document checklist with upload statuses
20. `borr_invoice_wizard.png` — Invoice submission wizard Step 2 (AI analysis results)
21. `borr_settlements.png` — Settlement advices with financial breakdown

### Funder (2 screenshots)
22. `funder_onboarding.png` — KYC form with entity info tab
23. `funder_marketplace.png` — Available invoices with bid button

### Counterparty (1 screenshot)
24. `counterparty_verify.png` — Token-based verification page with invoice details

### Common (1 screenshot)
25. `common_settings.png` — Settings page with MFA enrollment section

## Phase 3: Embed in Help Centre Content

Update each section in `userManualData.ts` to include markdown image references at the relevant step. Example:

```markdown
## Originator Dashboard

![Originator Dashboard](/screenshots/dashboard_originator.png)

The dashboard shows your key metrics at a glance...
```

Images placed after the heading they illustrate, before the explanatory text.

## Phase 4: Responsive Image Styling

Update `HelpCentreContent.tsx` markdown renderer to style embedded images:
- Max-width 100%, rounded corners, subtle border and shadow
- Click-to-expand lightbox (optional, using the existing `DocumentPreviewModal`)
- Proper alt text for accessibility

## Technical Notes

- Screenshots saved at 1280×720 viewport for consistency
- All screenshots use the app's actual UI components — not mockups
- Mock data uses GBP (£) currency consistent with UK trade finance context
- The seed data script will be a one-time edge function call, not permanent
- Old blank screenshots in `public/screenshots/` will be replaced

