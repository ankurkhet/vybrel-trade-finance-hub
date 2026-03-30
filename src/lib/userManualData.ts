import { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface ManualSection {
  id: string;
  title: string;
  content: string;
  roles: (AppRole | string | "all")[];
  category: string;
}

export const MANUAL_CATEGORIES = [
  { id: "getting-started", label: "Getting Started" },
  { id: "admin", label: "Platform Administration" },
  { id: "originator", label: "Originator Operations" },
  { id: "borrower", label: "Borrower Journey" },
  { id: "funder", label: "Funder / Lender" },
  { id: "counterparty", label: "Counterparty" },
  { id: "common", label: "Common Features" },
];

export const USER_MANUAL_SECTIONS: ManualSection[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // GETTING STARTED
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "platform-overview",
    title: "Platform Overview",
    category: "getting-started",
    roles: ["all"],
    content: `
# Platform Overview

Vybrel is a multi-tenant trade finance platform connecting **Originators** (who source deals), **Borrowers** (who seek financing), **Funders/Lenders** (who provide capital), and **Counterparties** (debtors who verify invoices). A **Vybrel Admin** oversees the entire ecosystem.

## Six Portal Roles

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Vybrel Admin** | Platform governance & infrastructure | Manage all orgs, users, workflows, registry APIs, audit logs |
| **Originator Admin** | Manages borrower lifecycle & financing | Onboard borrowers, process invoices, credit committee, disbursements |
| **Broker Admin** | Introduces and manages borrowers | Similar to Originator but with read-only fee config and linked borrowers |
| **Borrower** | Seeks trade financing | Self-service onboarding, invoice submission, document uploads |
| **Funder / Lender** | Provides capital and manages risk | KYC onboarding, marketplace bidding, portfolio monitoring |
| **Counterparty** | Verifies invoices as debtor | Token-based invoice acceptance (no login required for external) |
| **Account Manager** | Originator team member | View borrowers, contracts, invoices, KYC docs (read-focused) |
| **Operations Manager** | Originator operations staff | Collections, disbursements, repayments processing |
| **Credit Committee Member** | Committee voter | Review applications, vote approve/reject/request info |

## Architecture Highlights

- **Row-Level Security (RLS)**: Every database table is protected with role-based policies. Users only see data belonging to their organization.
- **Audit Trail**: All significant actions are logged to an immutable audit log with user ID, IP address, and user agent.
- **Multi-Factor Authentication (MFA)**: TOTP-based MFA enrollment and challenge for sensitive operations.
- **AI-Powered Analysis**: Document classification, credit memo generation, invoice matching, and contract review powered by integrated AI models.
`,
  },
  {
    id: "login-authentication",
    title: "Login & Authentication",
    category: "getting-started",
    roles: ["all"],
    content: `
# Login & Authentication

![Login Screen](/screenshots/auth_login_form.jpg)

## Role Selection Screen

When you navigate to the login page, you are presented with a **role selection grid** containing six role cards:
- Vybrel Admin, Originator, Broker, Borrower, Lender/Funder, Counterparty.
- Each card displays an icon, role name, and brief description.
- **Tap a role** to proceed to the credential entry screen.

> **Important**: Access is invitation-only. You must have received an invitation email from an administrator or originator before you can sign in.

## Authentication Methods

1. **Email + Password**: Enter your credentials and click "Sign In". A password visibility toggle (eye icon) lets you verify your input.
2. **Google OAuth**: Click "Continue with Google" for single sign-on. The system will match your Google email against existing accounts.

## Password Requirements

The platform enforces strong password policies:
- Minimum 8 characters
- At least one uppercase letter, one lowercase letter, one number
- At least one special character
- A real-time **password strength meter** shows Weak / Fair / Strong / Very Strong during registration

## Forgot Password

Click "Forgot password?" on the login screen to receive a password reset email. The reset link expires after a set period and redirects to a secure password update form.

## Multi-Factor Authentication (MFA)

- **Enrollment**: Navigate to Settings → Security to enable TOTP-based MFA. Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.).
- **Challenge**: After enabling MFA, each login requires a 6-digit verification code.
- **Transaction MFA**: Certain high-value operations (e.g., disbursement approval) may trigger an additional MFA challenge.

## Session Management

- Sessions are managed via secure tokens with configurable expiry.
- The **Session Manager** in Settings shows active sessions with device info and allows revoking individual sessions.

## Accept Invitation Flow

New users receive an invitation email with a secure token link. The flow:
1. Click the invitation link → lands on \`/invite/accept\`
2. The system validates the token (checks expiry, already-accepted status)
3. If the user doesn't have an account, they are prompted to create one with name + password
4. Upon acceptance, the user is assigned the invited role and linked to the correct organization
5. An audit log entry records the invitation acceptance

**Behind the scenes**: The \`accept-invitation\` edge function validates the token, creates the user account via the admin API, assigns the role in \`user_roles\`, updates the profile with the organization ID, and marks the invitation as accepted.
`,
  },
  {
    id: "dashboard-overview",
    title: "Dashboard & Navigation",
    category: "getting-started",
    roles: ["all"],
    content: `
# Dashboard & Navigation

![Originator Dashboard](/screenshots/dashboard_originator.jpg)

## Adaptive Dashboard

The dashboard dynamically adjusts based on your assigned roles:

**Admin Widgets**: Total Organizations, Total Users, Pending Document Reviews, AI Analyses completed
**Originator Widgets**: Borrowers (by onboarding status), Counterparties, Active Contracts, Pending Invoices, Total Credit Limits, Total Outstanding, Overdue Buckets (0-30d, 31-60d, 61-90d, 90+), Draft Credit Memos
**Borrower Widgets**: Uploaded Documents, Submitted Invoices, Available Credit Limit
**Funder Widgets**: Portfolio Exposure, Active Deals, Marketplace access

## Widget Customization

Click the **"Customize"** gear icon to open the widget panel where you can:
- **Toggle visibility** of each widget with a switch
- **Switch view modes** between Card (summary stat), Chart (visual), or Table (data grid)
- Preferences are automatically saved to your profile and persist across sessions

## Navigation Sidebar

The left sidebar shows role-appropriate menu items:
- Items are grouped by role (Admin, Originator, Borrower, Funder, Common)
- The active page is highlighted with an accent background
- On mobile, the sidebar is a slide-out drawer triggered by the hamburger menu
- A **notification bell** in the top-right header shows unread notifications

## Overdue Ageing Buckets

For Originators, the "Total Overdue" widget displays an ageing analysis:
- Invoices that are past their due date and in \`funded\` or \`partially_settled\` status
- Broken into 0-30 days, 31-60 days, 61-90 days, and 90+ days buckets
- Includes accrued late fees in the calculation
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "admin-organizations",
    title: "Managing Originators & Organizations",
    category: "admin",
    roles: ["admin"],
    content: `
# Managing Originators & Organizations

![Organizations Management](/screenshots/admin_organizations.jpg)

## Organization Lifecycle

Navigate to **Originators** in the sidebar. This view shows all originator organizations on the platform.

### Organization States
| Status | Meaning |
|--------|---------|
| \`pending_documents\` | Awaiting KYC/KYB document upload |
| \`under_review\` | Documents uploaded, pending admin review |
| \`approved\` | Fully verified, can operate |
| \`rejected\` | Failed compliance review |
| \`on-hold\` | Temporarily suspended |

### Creating an Organization
1. Click **"New Organization"**
2. Enter: Organization Name, Slug (URL identifier), Custom Domain (optional)
3. Add **Primary Contact**: Full Name, Email, Designation
4. Select **Labelling Mode**: Platform Label (Vybrel branding) or White Label (custom branding)
5. Save → the org is created in \`pending_documents\` status
6. An invitation is automatically sent to the primary contact email

### Organization Detail Panel

Click any organization row to open the **Detail Panel** which shows:
- **Overview**: Name, slug, status, creation date, labelling mode
- **Contacts**: List of organization contacts with invite status
- **Documents**: KYC/KYB compliance documents (see Document Lifecycle below)
- **Actions**: Approve/Reject organization, Send Invitations, Edit contacts

### Document Review Process

Each organization must upload compliance documents:
- View documents in a **row-based layout per document type**
- Each document shows: file name, upload date, status badge, notes
- **Review actions**: Approve ✓ or Reject ✗ (with mandatory rejection reason)
- Rejected documents are preserved for audit but don't block re-upload
- Multiple versions are supported — each new upload creates a version chain via \`parent_document_id\`
- Only Vybrel Admins can move documents to the **Delete Bin** (soft delete with \`is_deleted\` flag)

**RLS Policy**: Admins can manage all organizations. Org members can only view their own organization.
`,
  },
  {
    id: "admin-users",
    title: "User Governance & Roles",
    category: "admin",
    roles: ["admin"],
    content: `
# User Governance & Roles

![User Management](/screenshots/admin_users.jpg)

## All Users View

Navigate to **All Users** to see a searchable, filterable table of every user on the platform:
- Columns: Name, Email, Organization, Roles, Last Login, Active Status
- Filter by role, organization, or active/inactive status
- Search by name or email

## Role Architecture

Roles are stored in a dedicated \`user_roles\` table (not on the profile), preventing privilege escalation:
- A user can hold **multiple roles** (e.g., \`originator_admin\` + \`credit_committee_member\`)
- Roles are checked server-side via the \`has_role()\` security-definer function
- The \`get_user_roles()\` function returns all roles for a given user

### Available Roles
\`admin\`, \`originator_admin\`, \`originator_user\`, \`operations_manager\`, \`account_manager\`, \`borrower\`, \`funder\`, \`broker_admin\`, \`credit_committee_member\`

## User Management Actions

Admins can:
- **Create users** directly (via the \`admin-manage-users\` edge function which uses the Supabase Admin API)
- **Assign/remove roles** for any user
- **Deactivate/reactivate** user accounts
- **Reset passwords** via email
- **View audit trail** of user actions

**Behind the scenes**: The \`admin-manage-users\` edge function handles user creation, role assignment, password resets, and deactivation using the Supabase service role key. All operations are logged to \`audit_logs\`.

## Email Domain Settings

Admins can configure email domain restrictions to control which email domains are allowed for new user registrations within specific organizations.
`,
  },
  {
    id: "admin-workflow-studio",
    title: "Workflow Studio",
    category: "admin",
    roles: ["admin"],
    content: `
# Workflow Studio

![Workflow Studio Canvas](/screenshots/admin_workflow_studio.jpg)

Navigate to **Workflow Studio** from the sidebar. This is a visual workflow builder for managing platform-wide business logic without code changes.

## Supported Workflow Types

| Workflow | Description |
|----------|-------------|
| Invoice Lifecycle | Status transitions from pending → approved → funded → settled |
| Borrower Onboarding | Steps through the 9-step wizard including NDA gate |
| Credit Committee | Application submission → voting → decision → limit assignment |
| Facility Request | Request → review → approval → activation |
| Disbursement/Settlement | Memo creation → maker-checker approval → payment confirmation |

## Visual Canvas

The workflow canvas uses **React Flow** (\`@xyflow/react\`) to render:
- **Status Nodes**: Represent states (e.g., "Pending", "Approved", "Funded")
- **Transition Edges**: Show allowed state changes with conditions
- **Action Nodes**: Trigger automated actions (e.g., send notification, update status)

## Version Control

Workflows follow a git-like version model:
- **Draft**: Work-in-progress version being edited
- **Published/Live**: The active version controlling platform behavior
- Each version has: version number, label, creation date, author
- Publishing a draft instantly updates platform behavior
- Previous versions are preserved for rollback

## Rules Editor

Each transition can have rules attached:
- **Conditions**: e.g., "Only if all documents are approved", "Only if credit limit > 0"
- **Actions**: e.g., "Send email notification", "Create audit log entry", "Update related records"
- Rules are stored as JSON in the \`workflow_versions\` table

**RLS Policy**: Only Admins can manage workflows. Authenticated users can view published versions.
`,
  },
  {
    id: "admin-registry-apis",
    title: "Registry API Management",
    category: "admin",
    roles: ["admin"],
    content: `
# Registry API Management

Navigate to **Registry APIs** to manage external data provider connections used for KYB verification.

## Supported Registries

The platform integrates with multiple company registries:
- **Companies House** (UK) — Company profiles, filing history, officers
- **Open BRIS** — EU/EEA fallback for 30 countries when country-specific APIs are unavailable
- **OpenSanctions** — PEP and sanctions screening
- **TrueLayer** — Bank account name verification
- **Creditsafe** — Credit reports and financial data

## Health Monitoring

Each registry connection has automated health checks:
- **Status Indicators**: Healthy (green), Unhealthy (red), Unknown (grey)
- Health checks run periodically and on-demand
- If an API becomes unhealthy, a **daily prompt** is sent to Vybrel administrators until restored
- Health status, message, and last check timestamp are stored per registry

## Configuration

For each registry, you can configure:
- **API Key / Credentials**: Securely stored as Supabase secrets
- **Base URL**: Endpoint for the registry API
- **Active/Inactive** toggle: Disable a registry without removing its configuration
- **Country Mapping**: Which countries this registry serves

## How Registry Lookup Works

The \`registry-lookup\` edge function:
1. Receives a company name and/or registration number + country
2. Identifies which registries are active for that country
3. Queries each registry in parallel
4. Returns consolidated results with source attribution
5. Updates health status based on response success/failure
6. If a registry fails, it records the error and continues with remaining registries
`,
  },
  {
    id: "admin-audit-logs",
    title: "Audit Logs & Compliance",
    category: "admin",
    roles: ["admin"],
    content: `
# Audit Logs & Compliance

Navigate to **Audit Logs** to view the immutable activity trail.

## What Gets Logged

Every significant action on the platform creates an audit entry:
- **Authentication**: Login, logout, MFA enrollment, password changes
- **Data Changes**: Document uploads/reviews, borrower onboarding updates, invoice status changes
- **Financial Operations**: Disbursement approvals, collection confirmations, settlement generation
- **Administrative Actions**: User creation, role changes, organization approvals
- **AI Operations**: Credit memo generation, document analysis, invoice matching

## Audit Log Fields

| Field | Description |
|-------|-------------|
| \`action\` | The action performed (e.g., \`login\`, \`document_approved\`, \`disbursement_created\`) |
| \`resource_type\` | The entity type (e.g., \`session\`, \`document\`, \`disbursement_memo\`) |
| \`resource_id\` | The specific record ID affected |
| \`user_id\` / \`user_email\` | Who performed the action |
| \`ip_address\` | Client IP address |
| \`user_agent\` | Browser/client information |
| \`details\` | JSON object with action-specific metadata |

## Security Controls

- Audit logs are **append-only**: Users can insert but never update or delete entries
- Only Admins can read audit logs (enforced by RLS)
- The \`audit-logger\` client-side utility batches log entries for performance and calls \`forceFlush()\` on critical operations like sign-out
`,
  },
  {
    id: "admin-products",
    title: "Product & Subscription Management",
    category: "admin",
    roles: ["admin"],
    content: `
# Product & Subscription Management

Navigate to **Products** to manage subscription plans available to originators.

## Subscription Plans

Each plan defines:
- **Name**: e.g., Starter, Professional, Enterprise
- **Price (GBP)**: Monthly subscription cost
- **Limits**: Max borrowers, max funders, max monthly volume
- **Features**: JSON array of included feature descriptions
- **Flags**: \`is_active\` (visible to new subscribers), \`is_popular\` (highlighted in UI)
- **Sort Order**: Display priority on pricing pages

Plans can be viewed by anyone (including anonymous users) but only managed by Admins.
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ORIGINATOR
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "originator-borrowers",
    title: "Borrower Management",
    category: "originator",
    roles: ["originator_admin", "account_manager"],
    content: `
# Borrower Management

![Borrower List](/screenshots/orig_borrower_list.jpg)

Navigate to **Borrowers** to view and manage all borrowers in your organization.

## Borrower List

The borrower table displays:
- Company Name, Contact Email, Onboarding Status, KYC Status, AML Cleared, Credit Limit
- Filter by onboarding status or search by company name
- Click any row to drill down into the **Borrower Detail** view

## Onboarding Status Flow

\`invited\` → \`in_progress\` → \`under_review\` → \`approved\` / \`rejected\`

## Borrower Detail View

The detail page provides a comprehensive 360° view with tabs:

### Profile Tab
- Company information (name, registration, country, industry, SIC codes)
- Contact details, addresses (registered + trading)
- Group structure (parent company, shareholding %)
- Financial summary (turnover, employees)

### KYC/KYB Documents Tab
- All uploaded documents with status badges
- Document preview with download capability
- Version history showing all uploads per document type
- Review actions (Approve/Reject with notes)

### Directors & Shareholders Tab
- List of company directors and beneficial owners
- Individual KYC documents (ID, proof of address)
- Shareholding percentages
- PEP/Sanctions screening results

### Registry Verification Tab
- Side-by-side comparison of user-provided data vs. registry records
- Field-level mismatch highlighting with distance calculations for addresses
- Data sourced from Companies House, OpenSanctions, etc.
- If the borrower edited auto-populated registry data, a **change audit trail** is flagged for review

### Contracts Tab
- Active facility agreements linked to this borrower
- Contract values, counterparties, start/end dates

### Credit Memo Tab
- AI-generated credit assessments
- Edit and review workflow
- Proposed credit limits with currency

### Facility Requests Tab
- All financing facility requests with approval status
- Approved amounts, tenor, pricing notes
`,
  },
  {
    id: "originator-credit-committee",
    title: "Credit Committee",
    category: "originator",
    roles: ["originator_admin", "credit_committee_member"],
    content: `
# Credit Committee

![Credit Committee Voting](/screenshots/orig_credit_committee.jpg)

Navigate to **Credit Committee** to manage credit decision workflows.

## Committee Configuration

Go to **Committee Config** to set up:
- **Quorum Type**: Fixed number or Majority
- **Total Active Members**: Number of committee members
- **Minimum Votes Required**: How many votes needed for a valid decision
- **Member Management**: Add/remove committee members by email, toggle active status

## Application Types

| Type | Description |
|------|-------------|
| \`new_limit\` | New credit limit for a borrower |
| \`limit_increase\` | Increase existing limit |
| \`limit_decrease\` | Decrease existing limit |
| \`debtor_limit\` | Limit for a specific debtor/counterparty |
| \`facility_approval\` | Approve a financing facility |

## Full Workflow

### 1. Creating an Application
- Navigate to Credit Committee → Click "New Application"
- Select application type, borrower, and debtor (if applicable)
- Attach supporting data (credit memo, financial documents)
- Save as draft or submit directly

### 2. Submission
- Status changes from \`draft\` → \`submitted\`
- \`submitted_at\` timestamp is recorded
- All committee members are notified

### 3. Voting Process
Each committee member can:
- **Approve**: Vote in favor
- **Reject**: Vote against (with mandatory notes)
- **Approve with Conditions**: Conditional approval with specific terms
- **Request More Information**: Pauses the application and sends a question to the originator

### 4. Information Request Flow
- When a member clicks "Request More Info", a question is recorded in \`credit_committee_info_requests\`
- Status is set to \`pending\` until the originator provides an answer
- Once answered (\`answered_at\` timestamp set), the requesting member is notified
- The application resumes for continued voting

### 5. Decision
- When minimum votes are reached, the application can be decided
- Decision is recorded with notes in \`decision\` and \`decision_notes\`
- \`reviewed_at\` timestamp marks the decision time

### 6. Re-raising Applications
- After a final decision, applications can be **re-raised** (reopened)
- This creates a new application linked via \`parent_application_id\`
- The linked history provides a complete audit trail of all reviews

### 7. Automatic Limit Assignment
- Upon approval, the borrower's \`credit_limit\` is automatically updated
- For debtor limits, the counterparty limit is set
- These limits are **read-only** for borrowers and counterparties

## Meeting Minutes
- Automated minute generation records attendees, votes, and decisions
- Minutes can include attachments and custom text
- Stored in \`credit_committee_minutes\` linked to the application

**RLS Policies**:
- Org admins can manage all applications for their org
- Committee members can view and update (vote on) their org's applications
- Individual users can view applications they created
`,
  },
  {
    id: "originator-credit-memos",
    title: "AI Credit Memo Generation",
    category: "originator",
    roles: ["originator_admin"],
    content: `
# AI Credit Memo Generation

Navigate to **Credit Memos** to manage AI-assisted credit assessments.

## Overview

Credit memos are professional risk assessment documents generated using AI analysis of borrower data, registry filings, and financial information.

## Generation Process

### Prerequisites
Before generating a memo, the system checks:
- All KYC/KYB documents must be uploaded
- Ideally, all documents should be in \`approved\` status
- A warning banner appears if documents are not yet verified

### Step 1: AI Draft Generation
1. Navigate to a borrower's detail page → Credit Memo tab
2. Click **"Generate AI Draft"**
3. The \`ai-credit-memo\` edge function:
   - Collects borrower profile data (company info, directors, financials)
   - Retrieves registry data (Companies House filings, sanctions screening)
   - Analyzes uploaded financial documents
   - Generates a structured memo following the standardized format

### Data Priority Model
1. **Primary**: Borrower-provided data (onboarding form, uploaded documents)
2. **Secondary**: Official registry filings (Companies House, Open BRIS)
3. **Tertiary**: Financial APIs (Creditsafe, Financial Modeling Prep)
4. **Fallback**: Internet research (clearly labeled as such)

### Step 2: Analyst Review & Editing
- The AI draft appears in a rich text editor
- The Credit Manager can:
  - Edit any section of the memo
  - Adjust the proposed credit limit and currency
  - Add analyst commentary
  - Change the risk rating

### Step 3: Status Workflow

| Status | Description |
|--------|-------------|
| \`draft\` | Initial AI-generated or manually created |
| \`in_review\` | Submitted for peer review |
| \`reviewed\` | Peer review completed with feedback |
| \`approved\` | Final approval by authorized person |
| \`submitted_to_committee\` | Sent to Credit Committee for decision |

### Step 4: Committee Submission
- Approved memos can be submitted to the Credit Committee
- This automatically creates a Credit Committee Application linked to the memo
- The committee then follows its standard voting process

## Memo Content Structure
The generated memo follows a 20+ section professional format including:
- Executive Summary
- Borrower Background & History  
- Corporate Structure & Ownership
- Directors & Key Personnel
- Financial Analysis (multi-year tables)
- Industry Analysis
- Risk Assessment & Mitigants
- Facility Terms & Conditions
- Recommendation & Proposed Limit
`,
  },
  {
    id: "originator-invoices",
    title: "Invoice Processing",
    category: "originator",
    roles: ["originator_admin", "account_manager", "operations_manager"],
    content: `
# Invoice Processing

Navigate to **Invoices** to view and manage all financing requests.

## Invoice List

The invoice table shows:
- Invoice Number, Borrower, Debtor, Amount, Currency, Status, Due Date, Match Score
- Filter by status: Pending, Approved, Funded, Rejected, Settled
- Search by invoice number, borrower name, or debtor name

## Invoice Statuses

| Status | Description |
|--------|-------------|
| \`pending\` | Newly submitted, awaiting originator review |
| \`approved\` | Accepted for financing |
| \`funded\` | Capital disbursed to borrower |
| \`rejected\` | Declined by originator |
| \`settled\` | Fully repaid and closed |
| \`partially_settled\` | Partial repayment received |

## Product Types

| Product | Description |
|---------|-------------|
| Receivables Purchase | Sale of trade receivables at a discount |
| Reverse Factoring | Buyer-initiated supplier financing |
| Payables Finance | Early supplier payment via third-party funder |

## Counterparty Acceptance

If an invoice requires counterparty acceptance (\`requires_counterparty_acceptance = true\`):
1. A secure token is generated (\`acceptance_token\`)
2. The counterparty receives a verification link via the \`notify-counterparty\` edge function
3. Acceptance statuses: \`pending\` → \`accepted\` / \`rejected\`
4. **Invoices requiring acceptance cannot be approved by the Originator until verification is complete**

## AI Invoice Matching

The \`ai-match-invoice\` edge function analyzes uploaded invoice documents against contract terms:
- Extracts key data points (amounts, dates, parties)
- Compares against existing contracts for the borrower
- Generates a **match score** (0-100%)
- Highlights discrepancies in \`match_details\` JSON
`,
  },
  {
    id: "originator-fee-config",
    title: "Fee Configuration",
    category: "originator",
    roles: ["originator_admin"],
    content: `
# Fee Configuration

Navigate to **Fee Config** to manage financial terms per product type.

## Product-Level Configuration

Each of the three product types has its own fee configuration:

| Parameter | Description |
|-----------|-------------|
| **Originator Fee %** | Percentage charged by the originator |
| **Platform Fee %** | Vybrel platform fee percentage |
| **Default Discount Rate** | Standard discount rate for invoice purchasing |
| **Settlement Days** | Number of days for settlement processing |
| **Settlement Timing** | \`advance\` (pay upfront) or \`arrears\` (pay on collection) |
| **Notes** | Free-text notes about the configuration |

## Payment Instructions

Each product configuration stores the Originator's banking details used for auto-generating settlement advice:
- Bank Name, Account Name, Account Number
- Sort Code, IBAN, SWIFT/BIC
- Reference Prefix (for payment references)

These details are used by the \`generate-settlement\` edge function when creating disbursement and repayment advices.

## How Fees Are Calculated

For a disbursement:
- **Advance Amount** = Invoice Value × Advance Rate %
- **Originator Fee** = Advance Amount × Originator Fee %
- **Funder Fee** = Advance Amount × Funder Margin %
- **Total Fee** = Originator Fee + Funder Fee
- **Disbursement Amount** = Advance Amount − Total Fee
- **Retained Amount** = Invoice Value − Advance Amount

For a repayment:
- **Retained Reimbursement** = Original Retained Amount − Balance Due − Overdue Fees

**RLS**: Originator admins can manage their own org's fee configs. Brokers have read-only access.
`,
  },
  {
    id: "originator-disbursements",
    title: "Disbursements & Maker-Checker",
    category: "originator",
    roles: ["originator_admin", "operations_manager"],
    content: `
# Disbursements & Maker-Checker

Navigate to **Disbursements** to manage financing payouts.

## Creating a Disbursement Memo

1. Click **"Create Disbursement"**
2. Select an approved invoice from the dropdown
3. Select the linked facility (must be approved)
4. Configure:
   - **Advance Rate** (default 80%): Percentage of invoice value to advance
   - **Originator Fee**: Fee amount charged by originator
   - **Funder Fee**: Fee amount for the funding party
   - **Funder**: Select the participating funder (optional)
5. The system auto-calculates:
   - Advance Amount = Invoice Value × Advance Rate
   - Total Fee = Originator Fee + Funder Fee
   - Disbursement Amount = Advance Amount − Total Fee
   - Retained Amount = Invoice Value − Advance Amount

## Maker-Checker Rule

**Critical Business Rule**: The person who creates a disbursement memo **cannot** approve it.

- If \`created_by === current_user\`, the approve button shows an error: *"Maker-Checker Rule: You cannot approve a disbursement you created."*
- A different authorized user (Originator Admin or Operations Manager) must review and approve
- This ensures segregation of duties for financial operations

## Disbursement Status Flow

\`draft\` → \`pending_approval\` → \`approved\` → \`disbursed\`

## Payment Confirmation

After approval, the Operations team records the actual payment:
- Enter **Payment Date** and **Payment Reference**
- Status updates to \`disbursed\` with \`disbursed_at\` timestamp
- All actions are logged to the audit trail

## Settlement Advice Generation

The \`generate-settlement\` edge function creates professional settlement documents:
- Pulls fee config and payment instructions
- Generates formatted advice with all financial calculations
- Includes originator banking details for payment routing
`,
  },
  {
    id: "originator-repayments",
    title: "Repayments & Collections",
    category: "originator",
    roles: ["originator_admin", "operations_manager"],
    content: `
# Repayments & Collections

## Collections

Navigate to **Collections** to manage incoming payments from debtors.

### Recording a Collection
1. Select the invoice being repaid
2. Enter: Collection Date, Collected Amount, Payment Reference
3. Optionally add notes and debtor name
4. Submit for confirmation

### Collection Statuses
| Status | Description |
|--------|-------------|
| \`pending\` | Recorded but not confirmed |
| \`confirmed\` | Verified by operations |
| \`rejected\` | Collection entry rejected |

### Confirmation Process
- A different team member confirms the collection (maker-checker principle)
- \`confirmed_by\` and \`confirmed_at\` are recorded
- The related invoice status updates accordingly

## Repayment Memos

Navigate to **Repayments** to manage the repayment lifecycle.

### Repayment Calculation
- **Retained Amount Reimbursement** = Original Retained Amount − Balance Amount Due − Total Overdue Fees
- Repayment advice is issued **only once the entire repayment against an outstanding invoice has been received**
- Operations review is required for final release

### Overdue Fee Tracking
- Invoices past their due date accrue late fees
- The \`accrued_late_fees\` field tracks accumulated penalties
- Overdue fees are deducted from the retained amount reimbursement

## Settlement Advice

The system generates formatted settlement documents for all parties:
- **Borrower**: Shows advance received, fees deducted, retained amount
- **Funder**: Shows participation amount, returns, fees earned
- **Originator**: Internal memo with full financial breakdown
`,
  },
  {
    id: "originator-counterparties",
    title: "Counterparty Management",
    category: "originator",
    roles: ["originator_admin"],
    content: `
# Counterparty Management

Navigate to **Counterparties** to manage invoice debtors.

## Counterparty Records

Each counterparty record contains:
- Company Name, Contact Name, Contact Email, Contact Phone
- Country, Registration Number
- Linked to the originator's organization via \`organization_id\`

## Linking to Borrowers

Counterparties are linked to borrowers via the \`borrower_counterparties\` junction table, establishing the triangular relationship:
- Originator ↔ Borrower ↔ Counterparty (Debtor)

## Verification Flow

When an invoice requires acceptance:
1. The \`notify-counterparty\` edge function sends a secure email
2. External counterparties verify via a **tokenized public link** (no login required)
3. Registered counterparties use a **dedicated dashboard** (\`/counterparty/dashboard\`)
4. Borrowers can also upload **signed acceptance evidence** on behalf of the counterparty

**RLS**: Org admins can manage counterparties. Org members and broker admins have read-only access.
`,
  },
  {
    id: "originator-contracts",
    title: "Contract Repository",
    category: "originator",
    roles: ["originator_admin", "account_manager"],
    content: `
# Contract Repository

Navigate to **Contracts** to view all facility agreements.

## Contract Fields

| Field | Description |
|-------|-------------|
| Title | Agreement name |
| Contract Number | Unique identifier |
| Borrower | Linked borrower entity |
| Counterparty | The debtor party |
| Contract Value | Total agreement value |
| Currency | Agreement currency |
| Start/End Date | Validity period |
| Status | active, expired, draft, terminated |
| Terms Summary | JSON of key contractual terms |
| Risk Flags | JSON array of identified risk items |

## AI Contract Review

The \`ai-review-contract\` edge function analyzes uploaded contract documents:
- Extracts key terms and conditions
- Identifies risk flags (unfavorable clauses, missing protections)
- Generates a summary of critical provisions
- Results are stored in \`ai_analyses\` and linked via \`source_contract_id\`
`,
  },
  {
    id: "originator-lender-management",
    title: "Lender / Funder Relationship Management",
    category: "originator",
    roles: ["originator_admin"],
    content: `
# Lender / Funder Relationship Management

Navigate to **Lender Management** to oversee funder relationships.

## Funder Relationships

Each relationship represents an agreement between an originator and a funder:
- **Agreement Status**: pending, active, suspended, terminated
- **Master Pricing**: Base rate type, base rate value, margin percentage
- Created via invitation from the originator

## Funder Limits

Credit limits that originators refer to funders for assessment:
- **Borrower**: Which borrower the limit applies to
- **Counterparty Name**: Specific debtor (optional)
- **Limit Amount**: Proposed credit exposure
- **Currency**: Limit currency
- **Pricing**: Base rate type/value and margin percentage
- **Status**: pending, approved, rejected

When a funder approves a limit, it becomes locked and feeds into the platform's available funding calculations.

## Branding & White-Label

Navigate to **Branding** or **Branding Profiles** to customize the platform appearance:
- Upload logo (full and icon versions), favicon
- Set custom colors (primary, secondary, accent)
- Configure font family
- Set custom domain, email sender name, footer text, login welcome message
- Support email address
- Multiple branding profiles can exist (only one active at a time)
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BORROWER
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "borrower-onboarding",
    title: "Self-Service Onboarding Wizard",
    category: "borrower",
    roles: ["borrower"],
    content: `
# Self-Service Onboarding Wizard

Navigate to **Onboarding** to complete your account setup.

## Step 0: NDA Signing Gate

Before any onboarding steps are accessible, you must sign the Non-Disclosure Agreement:
- The NDA document is provided by the Originator's Operations Manager
- Supports both **manual upload** of signed NDA and **DocuSign API integration**
- Until the NDA is signed (\`nda_signed = true\`), all other steps are blocked
- The \`nda_signed_at\` timestamp records when the NDA was executed

## 9-Step Wizard

### Step 1: Signatory Information
- Full name, email, designation, date of birth
- Checkbox: "Is the signatory also a director?"
- This person is the authorized representative for the borrower

### Step 2: Company Information
- Company Name (as per registration documents), Trading Name
- Registration/Company Number — auto-populates from registry if available
- Country (searchable dropdown with 200+ countries)
- Incorporation Date (date picker, max today, from year 1900)
- SIC Code(s) — auto-maps to Industry/Sector via \`sicToIndustry()\` function
- Registered Office Address (with global autofill via \`address-lookup\` edge function)
- Trading/Operational Address
- Contact details (phone, website, email)
- Additional Info: VAT/Tax ID, Number of Employees, Annual Turnover
- Group Structure: Parent company name and shareholding %

### Step 3: Directors & Shareholders
- Add multiple directors with: First/Middle/Last name, DOB, Nationality, Email, Phone
- Role: Director, Secretary, PSC (Person of Significant Control)
- Shareholding percentage per director
- Residential address with autofill
- ID document upload per director

### Step 4: Facility Requirements
- Facility type selection (Receivables Purchase, Reverse Factoring, Payables Finance)
- Amount requested and currency
- Tenor (months)
- Pricing notes

### Step 5: Current Lenders
- Add existing lending relationships
- Fields: Lender Name, Facility Nature, Amount, Currency, Secured/Unsecured
- Repayment schedule, notes
- Checkbox: "Does the company have existing invoice facilities?"
- If yes: describe other invoice facilities

### Step 6: Bank Details
- Bank Name, Account Name, Account Number, Sort Code
- IBAN, SWIFT/BIC
- **TrueLayer Name Verification**: The \`truelayer-name-verify\` edge function validates that the bank account name matches the borrower's company name
- Health check ensures TrueLayer connectivity before verification

### Step 7: Document Checklist
- Upload required KYC/KYB documents
- Individual documents: Passport, Driving Licence, Proof of Address
- Company documents: Certificate of Incorporation, Memorandum of Association, Bank Statements, etc.
- Pre-upload staging area for file preview and AI validation
- The \`ai-validate-doc-type\` edge function checks if the uploaded file matches the selected document type
- Each document can have notes attached

### Step 8: Review & Submit
- Summary of all entered information across all steps
- Final review before submission
- Submit changes onboarding status from \`in_progress\` → \`under_review\`

### Step 9: Complete
- Confirmation screen showing submission status
- Next steps information

## Auto-Save & Save-and-Return
- All wizard steps auto-save progress to the database
- You can leave and return at any time — your progress is preserved
- The wizard remembers which step you were on
`,
  },
  {
    id: "borrower-invoices",
    title: "Invoice Submission & Tracking",
    category: "borrower",
    roles: ["borrower"],
    content: `
# Invoice Submission & Tracking

## Invoice Submission Wizard

Navigate to **My Invoices** → Click **"Submit Invoice"** to open the wizard.

### Step 1: Upload Documents
- Drag & drop or click to upload invoice-related documents
- Supported document types: Invoice, Proof of Delivery, Purchase Order, Bill of Lading, Contract, Credit Note, Statement of Account, Insurance Certificate, and more
- Multiple files can be uploaded simultaneously
- **Facility Selection**: You must select an approved financing facility before proceeding

### Step 2: AI Analysis
After upload, the system automatically:
1. Classifies each document using \`ai-validate-doc-type\` (identifies invoice vs. supporting docs)
2. Extracts key data: Invoice number, debtor name, amount, dates, product type
3. Generates observations (warnings, recommendations)
4. Identifies missing required documents
5. AI confidence scores are shown per document

### Step 3: Review & Submit
- Review AI-extracted data and make corrections
- Edit invoice details: Number, Debtor Name, Amount, Currency, Issue Date, Due Date
- Select product type and whether counterparty acceptance is required
- Toggle counterparty acceptance and enter counterparty email
- Add comments per document or overall
- Submit creates an \`invoice_submission\` record linked to documents and an \`invoice\` record

### Validation Rules
- **Facility Limit Check**: Requested amount cannot exceed available facility limit
- **Invoice Value Check**: Funding amount cannot exceed total invoice value
- Each submission gets a unique \`request_number\` (auto-generated: REQ-YYYYMMDD-NNNNN)

## Tracking Invoices

The invoice list shows all your submitted invoices with:
- Invoice Number, Debtor, Amount, Status, Acceptance Status
- Click any invoice to view full details including AI analysis results
- Track the journey from submission → originator review → funding → settlement

## Document Re-upload

If a document is rejected:
1. You receive notification of the rejection with the reason
2. Navigate to the document and click "Re-upload"
3. The new version is linked via \`parent_document_id\` maintaining full history
4. Rejected versions are preserved in the audit trail but don't block progress once a valid version is accepted
`,
  },
  {
    id: "borrower-documents",
    title: "Document Management",
    category: "borrower",
    roles: ["borrower"],
    content: `
# Document Management

Navigate to **My Documents** to manage all your uploaded files.

## Document Types

### Individual KYC
- Passport
- Driving Licence / National ID
- Proof of Address (utility bill, bank statement)
- Other Government-Issued ID

### Company KYB
- Certificate of Incorporation
- Memorandum & Articles of Association
- Recent Bank Statements
- Latest Audited Financial Statements
- Management Accounts
- Tax Returns
- Certificate of Good Standing
- Board Resolution
- Other

## Document Lifecycle

Each document goes through these states:
1. **Pending**: Uploaded but not yet reviewed
2. **Approved**: Reviewed and accepted by the originator/admin
3. **Rejected**: Reviewed and declined (rejection reason provided)

### Version History
- Every re-upload creates a new version linked to the original via \`parent_document_id\`
- Version numbers increment automatically
- All versions are preserved for audit purposes
- The latest approved version is the "active" document

### Notes & Comments
- You can attach notes to each document during upload
- Reviewers can add review notes when approving/rejecting
- Notes are visible to both borrower and originator

## Document Preview
- Click any document to preview it in a modal
- Supported formats: PDF, images (JPG, PNG), Word documents
- Download option available for all documents
`,
  },
  {
    id: "borrower-settlements",
    title: "Settlement Advices & Reports",
    category: "borrower",
    roles: ["borrower"],
    content: `
# Settlement Advices & Reports

## Settlement Advices

Navigate to **Settlements** to view your financing transaction history.

Each settlement advice shows:
- **Disbursement Details**: Invoice value, advance rate, advance amount, fees deducted, net disbursement
- **Repayment Details**: Total collected, retained amount reimbursement, overdue fee deductions
- **Payment Information**: Payment date, reference number, banking details

## Reports

Navigate to **My Reports** for:
- Invoice summary reports
- Document status overview
- Financial transaction history
- Export capabilities (CSV, PDF)

## My Profile

Navigate to **My Profile** to view and update your:
- Personal information (name, phone, avatar)
- Company association
- Account settings
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNDER
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "funder-onboarding",
    title: "Funder KYC & Onboarding",
    category: "funder",
    roles: ["funder"],
    content: `
# Funder KYC & Onboarding

Navigate to **Onboarding & KYC** to complete your funder registration.

## KYC Form (Tabbed Interface)

### Entity Information Tab
- **Entity Name**: Legal name of the funding entity
- **Entity Type**: Bank/Credit Institution, Non-Bank Financial Institution, Investment Fund/LP, Corporate Treasury, or Other
- **Registration Number**: Company registration identifier
- **Country of Incorporation**: Select from supported countries
- **Registered Address**: Full address

### Regulatory Tab
- **Regulatory Status**: Licensed, Exempt, Unregulated
- **Regulator Name**: Name of the supervisory authority
- **Licence Number**: Regulatory licence identifier

### Contact Tab
- **Contact Name, Email, Phone**: Primary contact for the funding entity

### Banking Tab
- **Bank Details**: Bank Name, Account Name, Account Number, Sort Code
- **International**: IBAN, SWIFT/BIC
- Used for receiving disbursement proceeds and settlement payments

### Compliance Tab
- **AML Policy Confirmed**: Checkbox confirming internal AML policy exists
- **PEP Screening Confirmed**: Checkbox for Politically Exposed Persons screening
- **Sanctions Screening Confirmed**: Checkbox for sanctions list verification
- **Notes**: Additional compliance information

## KYC Status Flow

\`draft\` → \`submitted\` → \`under_review\` → \`approved\` / \`rejected\`

### Document Uploads
- Funders can upload supporting compliance documents
- Stored in the \`documents\` storage bucket
- Linked to the funder's user ID

**RLS**: Funders can only manage their own KYC data. Org admins can view KYC for funders linked to their organization.
`,
  },
  {
    id: "funder-marketplace",
    title: "Marketplace & Portfolio",
    category: "funder",
    roles: ["funder"],
    content: `
# Marketplace & Portfolio

## MSA Requirement (GAP-23)

Before accessing the marketplace, the system checks for an **active Master Service Agreement (MSA)**:
- Query: Does the funder have at least one \`funder_relationship\` with \`agreement_status = 'active'\`?
- If no active MSA exists, a warning banner is displayed
- Funders cannot submit bids without an active relationship

## Marketplace

Navigate to **Marketplace** to view available financing opportunities.

### Available Invoices
The marketplace shows approved invoices from originators:
- Invoice Number, Borrower Company, Debtor, Amount, Currency, Due Date
- Only invoices with \`status = 'approved'\` are visible to funders (enforced by RLS)

### Submitting a Bid (Funding Offer)
1. Click on an invoice to view details
2. Enter: Offer Amount, Discount Rate (optional), Notes
3. Submit creates a \`funding_offer\` record with status \`pending\`
4. The originator reviews and accepts/rejects the offer
5. Accepted offers update \`accepted_at\` and trigger the disbursement flow

### Realtime Updates
- The marketplace uses Supabase Realtime to show live updates
- New invoices appear automatically
- Offer status changes are reflected in real-time

## Portfolio

Navigate to **Portfolio** to monitor your funded positions:
- Total exposure across all funded deals
- Active deals count
- Performance metrics by borrower and originator
- Repayment tracking and settlement status

## Funder Limits

Credit limits are managed by originators and referred to funders:
- View all limits assigned to you with borrower details
- Approve or adjust proposed limits
- Approved limits become locked and feed into available funding calculations

## Reports & Settlements

- **Reports**: Portfolio performance, exposure analysis, returns
- **Settlements**: View settlement advices for funded deals, payment confirmations
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COUNTERPARTY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "counterparty-verification",
    title: "Counterparty Invoice Verification",
    category: "counterparty",
    roles: ["all"],
    content: `
# Counterparty Invoice Verification

## Dual-Path Verification Model

### Path 1: External Token-Based Verification (No Login Required)
1. When an invoice requires counterparty acceptance, a **secure token** is generated
2. The \`notify-counterparty\` edge function sends an email to the counterparty with a verification link
3. The link format: \`/verify-invoice?token=<64-char-hex-token>\`
4. The counterparty clicks the link and sees:
   - Invoice details: Number, Debtor Name, Amount, Currency, Issue Date, Due Date
   - Borrower company name and product type
5. To verify, the counterparty enters their **email address** (for identity confirmation) and optional notes
6. Actions: **Accept** ✓ or **Reject** ✗
7. The \`accept_invoice_by_token\` database function:
   - Validates the token matches a pending invoice
   - Updates \`acceptance_status\` on the invoice
   - Creates an \`invoice_acceptance\` record with method \`direct_counterparty\`

### Path 2: Registered Counterparty Dashboard
- Registered counterparties log in and navigate to **Verify Invoices** (\`/counterparty/dashboard\`)
- They see invoices where their email matches \`counterparty_email\`
- Can accept/reject with notes from the dashboard interface

### Path 3: Borrower Upload
- Borrowers can upload **signed acceptance evidence** (signed documents, emails) on behalf of the counterparty
- This creates an acceptance record with the evidence document attached

## Security

- Tokens are 32-byte random hex strings, cryptographically secure
- Each token is unique per invoice
- Tokens are validated against: existence, pending status, and \`requires_counterparty_acceptance = true\`
- The counterparty-verify edge function handles all token-based operations securely
`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMON FEATURES
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: "common-messaging",
    title: "Messaging & Notifications",
    category: "common",
    roles: ["all"],
    content: `
# Messaging & Notifications

## Messages

Navigate to **Messages** from the sidebar to access your inbox.

The messaging system supports communication between platform participants:
- Send and receive messages within your organization
- Threaded conversations for context
- Attachment support

## Notification Bell

The **notification bell** in the top-right header provides real-time alerts:
- Unread count badge
- Click to expand notification panel
- Types: Document reviews, invoice status changes, committee votes, system alerts
- Mark as read/unread

## Email Notifications

The platform sends email notifications for critical events:
- Invitation acceptance required
- Document review completed
- Invoice status changes
- Credit committee votes needed
- Settlement advice generated

Email delivery requires a **configured custom email domain** for the organization.
`,
  },
  {
    id: "common-settings",
    title: "Settings & Security",
    category: "common",
    roles: ["all"],
    content: `
# Settings & Security

Navigate to **Settings** from the sidebar.

## Profile Settings
- Update display name, phone number, avatar
- View your assigned roles and organization

## Security Settings
- **Change Password**: Update your login credentials
- **MFA Enrollment**: Enable/disable TOTP-based multi-factor authentication
- **Session Management**: View active sessions, revoke individual sessions
- **Security Headers**: The platform sets security headers (CSP, HSTS, X-Frame-Options) automatically

## Reports

Reports are available for all roles with role-specific content:
- **Admin Reports**: Platform-wide analytics, user activity, organization metrics
- **Originator Reports**: Borrower portfolio, invoice pipeline, collection performance
- **Borrower Reports**: Invoice history, document status, financial summary
- **Funder Reports**: Portfolio performance, exposure analysis, return metrics

### Export Capabilities
All reports support:
- **CSV Export**: Raw data download
- **PDF Export**: Formatted report download
- Charts and visualizations using Recharts (Bar, Line, Pie charts)
`,
  },
  {
    id: "common-kyb-verification",
    title: "KYB/KYC Verification Deep Dive",
    category: "common",
    roles: ["admin", "originator_admin", "account_manager"],
    content: `
# KYB/KYC Verification Deep Dive

## Registry Verification Tab

The Registry Verification tab on the Borrower Detail page provides comprehensive verification:

### Company Profile Verification
- **Data Source**: Companies House (UK), Open BRIS (EU/EEA), country-specific registries
- **Comparison Table**: Side-by-side view of user-provided vs. registry data
- **Field Matching**: Company name, registration number, incorporation date, registered address, SIC codes
- **Mismatch Highlighting**: Discrepancies are flagged with severity indicators
- **Address Distance**: Physical distance calculation between provided and registry addresses

### Director Verification
- Cross-reference directors against Companies House officer records
- Identify missing directors or shareholding discrepancies
- Date of birth and nationality verification

### PEP & Sanctions Screening
- **Source**: OpenSanctions API
- **Checks**: Directors and signatories screened against PEP lists and sanctions databases
- Results labeled by provider and section (e.g., "PEP Check", "Sanctions Check")
- Match confidence scores with detailed entity information

### Bank Name Verification
- **Source**: TrueLayer API
- **Process**: Validates that the bank account name matches the company name
- **Health Check**: System verifies TrueLayer connectivity before attempting verification
- Results include match status and confidence level

### Change Audit Trail
If a borrower edits auto-populated registry data during onboarding:
- The system maintains a detailed log of changes
- Changes are flagged for the Credit Manager's review
- Original vs. modified values are displayed side-by-side

### Multiple Company Resolution
If the registry lookup returns multiple companies:
- AI attempts to determine the correct entity
- If ambiguous, the Originator is prompted for clarification
- The selected entity is linked to the borrower profile

## AI Document Analysis

The \`ai-analyze-document\` edge function provides:
- Document classification (type identification)
- Data extraction (key fields, amounts, dates)
- Anomaly detection (suspicious patterns, inconsistencies)
- Quality assessment (readability, completeness)
`,
  },
];

export const filterManualContent = (
  sections: ManualSection[],
  userRoles: AppRole[],
  isAdmin: boolean,
  categoryFilter?: string
): ManualSection[] => {
  let filtered = sections;

  // Role filter
  if (!isAdmin) {
    filtered = filtered.filter(
      (section) =>
        section.roles.includes("all") ||
        section.roles.some((role) => userRoles.includes(role as AppRole))
    );
  }

  // Category filter
  if (categoryFilter && categoryFilter !== "all") {
    filtered = filtered.filter((s) => s.category === categoryFilter);
  }

  return filtered;
};
