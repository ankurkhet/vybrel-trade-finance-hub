# Vybrel Trade Finance Hub: Level 5 Standard Operating Procedure (SOP)

**Version**: 1.0  
**Status**: Operational  
**Owner**: Operations & Compliance  

---

## 📖 1. Introduction & Scope
This Level 5 Standard Operating Procedure (SOP) defines the end-to-end operational processes for the Vybrel Trade Finance Hub. It is designed to ensure consistency, transparency, and risk mitigation across all stakeholder interactions.

---

## 👥 2. Roles & Responsibilities

| Role | Responsibility |
| :--- | :--- |
| **Vybrel Admin** | Platform governance, Org/User setup, System audit. |
| **Originator Admin** | Portfolio oversight, Credit committee chair, Compliance officer. |
| **Operations Manager** | Disbursement execution, Collection recording, Settlement oversight. |
| **Account Manager** | Borrower relationship, Credit memo drafting, Facility management. |
| **Credit Committee Member**| Credit risk assessment, Voting, Quorum management. |
| **Borrower** | KYB completion, Invoice submission, Financial reporting. |
| **Funder** | KYC completion, Marketplace participation, Portfolio monitoring. |
| **Counterparty** | Invoice verification & acceptance. |

---

## 📈 3. Process Workflows

### 3.1 Borrower Onboarding & KYB
1.  **Initiation**: AM invites a Borrower via the "Invite Borrower" form.
2.  **Borrower Action**: Borrower enters the portal and completes the **Onboarding Wizard** (Company Details, Directors, Financials).
3.  **Document Submission**: Borrower uploads mandatory documents (COI, Articles, 3yr Accounts, Debenture).
4.  **Originator Review**: AM reviews the submission in `BorrowerDetail.tsx`.
5.  **Control Point**: AM must verify document authenticity before marking onboarding as "Pending Credit".

### 3.2 Credit Analysis & Facility Approval
1.  **Credit Memo**: AM creates a **Credit Memo** (`src/pages/originator/CreditMemos.tsx`) using financial data and AI-driven risk insights.
2.  **Raising Application**: Once the memo is "Internal Approved", AM raises a **Credit Committee Application**.
3.  **Committee Voting**: CC Members receive a notification and review the application in `CreditCommitteeApplicationDetail.tsx`.
    *   **Action**: Approve, Approve with Conditions, Reject, or Request Info.
4.  **Quorum & Decision**: The system automatically tallies votes based on the `credit_committee_config` (Quorum/Majority).
5.  **Automated Update**: Upon approval, the Borrower's **Credit Limit** is automatically updated in the core database.

### 3.3 The Funding Lifecycle (Invoices & Disbursements)
1.  **Invoice Submission**: Borrower submits invoices via the **Submission Wizard** or bulk upload.
2.  **AI Extraction**: The system uses OCR/AI to extract Invoice Number, Date, Debtor, and Amount.
3.  **Verification**: A secure verification link is emailed to the **Counterparty**.
4.  **Control Point (Maker)**: Ops Manager creates a **Disbursement Memo** (`src/pages/originator/Disbursements.tsx`).
    *   **Logic**: System checks against **Borrower Limits**, **Counterparty Limits**, and **Funder Relationship MSAs**.
5.  **Control Point (Checker)**: A secondary authorized user must approve the disbursement. 
    *   **Rule**: The creator (`created_by`) cannot be the approver (`approved_by`).

### 3.4 Collections & Settlement Waterfall
1.  **Payment Receipt**: The Counterparty pays into the designated Vybrel account.
2.  **Recording**: Ops Manager records the collection in `Collections.tsx` against the specific invoice.
3.  **Waterfall Trigger**: Saving the collection triggers the `generate-settlement` Edge Function.
4.  **Waterfall Hierarchy**:
    *   **1. Funder**: Principal + Yield (Discount).
    *   **2. Originator**: Platform fees + Management margin.
    *   **3. Borrower**: Retained Reimbursement (The remaining face value minus all fees and advance).
5.  **Distribution**: The system issues **Settlement Advices** (JSON/PDF) to all parties via their dashboards.

---

## 🔒 4. Risk & Compliance Controls

### 4.1 Disbursement Guardrails (GAP-11/31)
*   The system executes a real-time "Tightest Limit" check during disbursement.
*   **Safety**: If a disbursement would breach the specific Borrower/Counterparty limit or the global Borrower limit, the action is blocked.

### 4.2 Maker-Checker Protocol (GAP-34)
*   **Policy**: No single user can both create and approve a movement of funds.
*   **Implementation**: Enforced at the database level for both Disbursements and Repayments.

### 4.3 MSA Integrity (GAP-33)
*   **Policy**: Only the most recent Master Service Agreement (MSA) is active for any Funder relationship.
*   **Implementation**: New MSA uploads automatically mark old records as `superseded`.

---

## 📊 5. Reporting & Reconciliation
1.  **Daily Dunning (GAP-32)**: The `accrue_daily_interest` cron job runs at 00:00 UTC to calculate late fees on overdue funded invoices.
2.  **Overdue Aging (GAP-25/35)**: The Originator Dashboard provides a real-time chart of overdue debt binned into 30/60/90+ day buckets.
3.  **Audit Logs**: Every role change, limit update, and fund approval is captured in the **Audit Log Registry**.

---

## 🆘 6. Exception Management

| Event | Resolution Process |
| :--- | :--- |
| **Verification Refusal** | AM contacts Counterparty; Invoice status set to "Disputed". |
| **Limit Breach** | AM must re-raise a Credit Committee application for a limit increase. |
| **Edge Function Failure**| Vybrel Admin manually triggers settlement reconciliation via SQL terminal. |
| **KYC Rejection** | Funder/Borrower notified via Dashboard; specific feedback provided for re-submission. |

---

> [!IMPORTANT]
> Failure to adhere to the Maker-Checker protocol or bypassing limit guards constitutes a material breach of operational policy.
