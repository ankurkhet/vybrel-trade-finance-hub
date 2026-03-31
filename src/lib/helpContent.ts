export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  roles: string[];
  lastUpdated: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  // --- Platform Admin SOPs ---
  {
    id: "admin-onboarding",
    title: "Onboarding New Originators",
    category: "Operations",
    roles: ["admin"],
    lastUpdated: "2026-03-30",
    content: `
# SOP: Originator Onboarding
As a Platform Admin, you are responsible for the first gate of the Vybrel ecosystem.

## Steps:
1. **Org Creation**: Navigate to 'Manage Organizations' and create the entity.
2. **Assign SuperAdmin**: Invite the first user to that org and grant the 'originator' role.
3. **Credit Config**: Define the default system-wide credit limits (if applicable).
4. **Verification**: Confirm the 'onboarding_status' moves from 'pending' to 'active'.

> [!IMPORTANT]
> All Originator organizations must undergo manual KYC verification before they can invite Borrowers.
    `
  },
  {
    id: "admin-risk-engine",
    title: "Managing Risk & Pricing Benchmarks",
    category: "Risk Management",
    roles: ["admin"],
    lastUpdated: "2026-03-30",
    content: `
# Managing Pricing Benchmarks
The Vybrel automated pricing engine relies on daily market indices.

## Benchmark Maintenance:
- **Index Monitoring**: Check 'System Monitoring' for the status of the 'fetch-market-rates' Edge Function.
- **Manual Overrides**: If the BOE or FRED feed fails, use the 'Market Override' portal to input SOFR/SONIA values.
- **Strategic Matrix**: Ensure the 3-Product Matrix columns are correctly mapped in the DB.
    `
  },

  // --- Originator SOPs ---
  {
    id: "originator-lender-mgmt",
    title: "Strategic Lender Relationship Management",
    category: "Lender Portal",
    roles: ["originator"],
    lastUpdated: "2026-03-31",
    content: `
# Strategic Funder Management
Originators can now manage lenders using a **3-Product Strategic Rate Matrix**.

## The Matrix:
1. **Receivable Purchase**: Discounting of high-grade trade receivables.
2. **Reverse Factoring**: Supply-chain finance for large corporate buyers.
3. **Payable Finance**: Direct financing for procurement workflows.

## Configuration:
- Select the **Benchmark Index** (SOFR, SONIA, etc.)
- Define **Product Margins** for each specific funding line.
- **Cascade Updates**: Use the checkbox to sync these rates to ALL existing borrower contracts instantly.
    `
  },
  {
    id: "originator-kyc-audit",
    title: "Funder KYC / KYB Auditing",
    category: "Compliance",
    roles: ["originator"],
    lastUpdated: "2026-03-31",
    content: `
# Auditing Participating Lenders
The 'Documents' module now contains a dedicated 'Funder Audit' tab.

## Verification Workflow:
1. **Identify**: Sort using the Funder dropdown.
2. **Audit**: Review submitted KYC packets (Tax IDs, AML Policies).
3. **Decide**: Use the Green (Approve) or Red (Reject) icons to mark the audit result.
4. **Audit Trail**: Every decision is logged in the system for regulatory reporting.
    `
  },

  // --- Borrower SOPs ---
  {
    id: "borrower-limit-request",
    title: "Requesting New Credit Limits",
    category: "Financing",
    roles: ["borrower"],
    lastUpdated: "2026-03-25",
    content: `
# Seeking Capital
Borrowers can request credit lines for specific invoices or general facilities.

## Workflow:
- Navigate to 'Limits & Requests'.
- Upload supporting KYC/KYB documents.
- Wait for Originator credit committee review.
- Sign the digital terms once 'Facility Approved'.
    `
  },

  // --- Funder SOPs ---
  {
    id: "funder-risk-exposure",
    title: "Monitoring Your Capital Exposure",
    category: "Risk",
    roles: ["funder"],
    lastUpdated: "2026-03-28",
    content: `
# Real-time Exposure
As a Funder, you have transparency into which borrowing entities are using your capital.

## Monitoring:
- Check the 'Exposure' dashboard for utilization rates.
- Review 'Agreement Terms' to see the active rate matrix configured by the Originator.
- Download weekly repayment reports from the 'Reports' tab.
    `
  }
];

export const getArticlesForRole = (role: string) => {
  return HELP_ARTICLES.filter(a => a.roles.includes(role) || a.roles.includes('all'));
};
