import { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface ManualSection {
  id: string;
  title: string;
  content: string;
  roles: (AppRole | string | "all")[];
}

export const USER_MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "overview",
    title: "1. Platform Overview & Login",
    roles: ["all"],
    content: `
# Platform Overview & Login

Welcome to the Vybrel Trade Finance Hub. This manual provides a step-by-step guide on how to navigate and use the platform effectively.

## Role Selection & Login
**Action:** Navigate to the login page. Choose your designated role from the list.
**Screenshot:**  
![Role Selection](/screenshots/role_selection.png)
**Expected Result:** You see a grid of roles (Admin, Originator, Borrower, etc.).
**Notes / Tips:** 
- Your access is by invitation only. If you don't have an account, contact your administrator.

## Unified Dashboard
**Action:** After authenticating, look at the main dashboard.
**Screenshot:**  
![Dashboard Overview](/screenshots/dashboard_overview.png)
**Expected Result:** A summary of all active KPIs, including Total Organizations, Users, and AI Analyses.
**Notes / Tips:** The dashboard adapts based on your role, showing only metrics relevant to your organization.
`
  },
  {
    id: "admin-management",
    title: "2. Vybrel Admin: Registry & Organizations",
    roles: ["admin"],
    content: `
# Vybrel Admin: Registry & Organizations

As a Platform Admin, you are responsible for the infrastructure and high-level governance of the ecosystem.

## Managing Originators
**Action:** Click on "Originators" in the left sidebar.
**Screenshot:**  
![Admin Organizations](/screenshots/admin_organizations.png)
**Expected Result:** A list of all active originator organizations on the platform.
**Notes / Tips:** You can view details for each org, including their branding and active portfolios.

## User Governance
**Action:** Click on "All Users" to manage platform-wide identity.
**Screenshot:**  
![Admin Users](/screenshots/admin_users.png)
**Expected Result:** A searchable table of all users, their roles, and last login activity.
`
  },
  {
    id: "originator-workflow",
    title: "3. Originator: Managing the Lifecycle",
    roles: ["originator_admin", "account_manager", "operations_manager"],
    content: `
# Originator: Managing the Lifecycle

Originators are the heart of the platform, managing borrowers and financing workflows.

## Borrower Management
**Action:** Navigate to the "Borrowers" tab.
**Screenshot:**  
![Originator Borrowers](/screenshots/originator_borrowers.png)
**Expected Result:** View all borrowers and their current onboarding status.
**Notes / Tips:** Click on a borrower to view their drill-down profile, KYC docs, and historical limits.

## Contract Repository
**Action:** Click "Contracts" to see the master agreements.
**Screenshot:**  
![Originator Contracts](/screenshots/originator_contracts.png)
**Expected Result:** A repository of all active facility agreements.

## Invoice Processing
**Action:** Navigate to "Invoices" for financing requests.
**Screenshot:**  
![Originator Invoices](/screenshots/originator_invoices.png)
**Expected Result:** See all submitted invoices, their statuses, and match scores.
`
  },
  {
    id: "borrower-experience",
    title: "4. Borrower: Financing & Onboarding",
    roles: ["borrower"],
    content: `
# Borrower: Financing & Onboarding

Borrowers use Vybrel for fast submission and transparent tracking of their funding requests.

## Self-Service Onboarding
**Action:** Access the "Onboarding" wizard.
**Screenshot:**  
![Borrower Onboarding](/screenshots/borrower_onboarding.png)
**Expected Result:** A step-by-step checklist for KYC, Signatory Info, and Financials.
**Notes / Tips:** Detailed tooltips guide you through each required field.

## Invoice Tracking
**Action:** Navigate to "My Invoices".
**Screenshot:**  
![Borrower Invoices](/screenshots/borrower_invoices.png)
**Expected Result:** Audit trail of all financing requests and their current approval status from the Originator.
`
  },
  {
    id: "funder-experience",
    title: "5. Funder/Lender: Marketplace & Portfolio",
    roles: ["funder"],
    content: `
# Funder/Lender: Marketplace & Portfolio

Funders provide liquidity and manage their risk through the portfolio view.

## Marketplace Discovery
**Action:** Open the "Marketplace".
**Screenshot:**  
![Funder Marketplace](/screenshots/funder_marketplace.png)
**Expected Result:** View available financing opportunities from Originators.

## Portfolio Dashboard
**Action:** Click "Portfolio".
**Screenshot:**  
![Funder Portfolio](/screenshots/funder_portfolio.png)
**Expected Result:** A consolidated view of all participation across different borrowers and originators.
`
  }
];

export const filterManualContent = (sections: ManualSection[], userRoles: AppRole[], isAdmin: boolean): ManualSection[] => {
  if (isAdmin) return sections;
  return sections.filter(section => 
    section.roles.includes("all") || 
    section.roles.some(role => userRoles.includes(role as AppRole))
  );
};
