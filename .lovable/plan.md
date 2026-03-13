

# Plan: Reporting Layer, 2FA, Responsive Design & Mobile App

## 1. Reporting Layer per Portal

Add a `/reports` section within each portal with role-specific dashboards and exportable reports:

**Vybrel Admin Reports** (`/admin/reports`)
- Platform-wide AUM, pipeline volume, arrears summary
- Originator performance comparison
- System usage and user activity analytics
- Revenue/fee tracking across all originators

**Originator Reports** (`/originator/reports`)
- Borrower portfolio summary (exposure, utilization, limits)
- Deal pipeline and conversion metrics
- Credit committee decision history and turnaround times
- Collections performance (overdue aging, recovery rates)
- Funder allocation and concentration reports

**Borrower Reports** (`/borrower/reports`)
- Facility utilization and available limits
- Transaction history with status breakdown
- Repayment schedule and outstanding balances
- Document submission status tracker

**Funder Reports** (`/funder/reports`)
- Portfolio composition and performance
- Deal acceptance/rejection history
- Yield and return analytics
- Concentration and risk exposure reports
- Covenant compliance summaries

**Implementation approach:**
- Create a shared `ReportCard` component and `ReportPage` layout
- Use Recharts (already available via `chart.tsx`) for visualizations
- Add date range filters, export to CSV/PDF functionality
- Create a `reports` table in Supabase to store generated report metadata
- Use RLS to ensure each role only sees their own data

---

## 2. Two-Factor Authentication

### Login 2FA
- Integrate Supabase Auth MFA (TOTP) for login — users enroll via authenticator app during onboarding
- Add MFA enrollment screen after first login
- Add MFA challenge screen on subsequent logins
- Support all three methods (Email OTP, SMS OTP, TOTP) — user selects preferred method in settings

### Transaction 2FA
- Before any financial action (disbursement approval, repayment confirmation, facility changes), trigger a 2FA challenge modal
- Create a `TransactionMFAModal` component that:
  - Sends OTP via user's preferred channel (email/SMS/TOTP)
  - Validates the code via an edge function
  - Returns a signed confirmation token
  - Logs the verification in `audit_log`
- Edge function `verify-transaction-otp` handles code generation, sending, and validation
- Store `mfa_preferences` table for each user's chosen method

---

## 3. Responsive Design (Desktop / Tablet / Mobile)

- Use Tailwind responsive breakpoints throughout all portal layouts
- Sidebar navigation collapses to bottom tab bar on mobile, sheet/drawer on tablet
- Tables become card-based lists on small screens
- Dashboard grids reflow: 3-col (desktop) → 2-col (tablet) → 1-col (mobile)
- All forms stack vertically on mobile with full-width inputs
- Use existing `useIsMobile` hook, extend with `useIsTablet`

---

## 4. Mobile Application (PWA + Capacitor)

### Phase A: PWA (immediate)
- Install and configure `vite-plugin-pwa` with manifest, icons, and offline support
- Add mobile meta tags to `index.html`
- Create `/install` page with install prompt guidance
- Add `/~oauth` to service worker deny list

### Phase B: Capacitor (follow-up)
- Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
- Initialize with `npx cap init` using project-specific app ID
- Configure server URL for development hot-reload
- User will need to export to GitHub and build locally with Xcode/Android Studio

---

## New Files & Components

```text
src/
├── components/
│   ├── reports/
│   │   ├── ReportPage.tsx          — Shared report layout with filters
│   │   ├── ReportCard.tsx          — Metric card component
│   │   ├── ReportChart.tsx         — Chart wrapper for report visuals
│   │   └── ExportButton.tsx        — CSV/PDF export
│   ├── auth/
│   │   ├── MFAEnrollment.tsx       — TOTP/SMS/Email setup
│   │   ├── MFAChallenge.tsx        — Login 2FA verification
│   │   └── TransactionMFAModal.tsx — Financial transaction verification
│   └── layout/
│       ├── ResponsiveSidebar.tsx   — Collapsible sidebar / mobile nav
│       └── MobileTabBar.tsx        — Bottom navigation for mobile
├── hooks/
│   └── use-tablet.tsx              — Tablet breakpoint hook
├── pages/
│   ├── admin/Reports.tsx
│   ├── originator/Reports.tsx
│   ├── borrower/Reports.tsx
│   ├── funder/Reports.tsx
│   └── Install.tsx                 — PWA install page
supabase/
├── functions/
│   └── verify-transaction-otp/index.ts
└── migrations/
    └── xxx_add_reports_and_mfa.sql — reports, mfa_preferences tables
```

## Build Order

1. Responsive layout system (sidebar, tab bar, breakpoint hooks)
2. PWA configuration
3. Login 2FA (MFA enrollment + challenge)
4. Transaction 2FA modal + edge function
5. Report components and shared layout
6. Portal-specific report pages (Admin → Originator → Borrower → Funder)
7. Capacitor configuration for native apps

