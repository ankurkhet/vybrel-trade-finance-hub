

# Revised Plan: Real Screenshots + PDF/Print Fix

## Screenshot Strategy

Your all-roles login lets me capture every page. To handle the sidebar realism problem:

**Crop each screenshot to the main content area only** (exclude the sidebar). This way:
- Screenshots are role-neutral and accurate
- No misleading navigation items visible
- Content area is what matters for training purposes
- Cleaner, more focused visuals

I'll navigate to each page, take a full screenshot, then programmatically crop out the sidebar (~256px left strip) before saving.

## Execution

### Step 1 — Capture & crop ~20 real screenshots
- Navigate to each key page via browser automation at 1280x720
- Screenshot each page
- Crop to content area using a Python script (PIL/Pillow)
- Save cropped PNGs to `public/screenshots/`

Pages to capture (grouped by portal section shown in content area):
- Auth/Login page (no sidebar, full capture)
- Dashboard (originator view)
- Admin: Organizations, Users, Workflow Studio, Registry APIs
- Originator: Borrowers list, Borrower detail, Credit Committee, Credit Memos, Invoices, Disbursements, Collections, Fee Config
- Borrower: Onboarding steps, Invoice wizard, Settlements
- Funder: Onboarding, Marketplace
- Settings, Help Centre

### Step 2 — Fix PDF export pagination
Replace the single-canvas approach in `HelpCentreContent.tsx` with A4-paginated export:
- Render content to canvas at scale 2
- Slice into A4-height strips (842px at 72dpi)
- Add each strip as a separate PDF page
- Proper margins and page numbering

### Step 3 — Fix Print CSS
Enhance `@media print` styles to hide sidebar/search/controls and add page breaks between articles.

### Step 4 — Update userManualData.ts
Replace current placeholder image references with paths to the new real screenshots.

## Files Modified
- `public/screenshots/*.png` — replaced with real cropped captures
- `src/components/help/HelpCentreContent.tsx` — PDF pagination + print CSS
- `src/lib/userManualData.ts` — updated image paths

