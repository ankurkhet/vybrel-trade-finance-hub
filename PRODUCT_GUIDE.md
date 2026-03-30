# Vybrel Trade Finance Hub: Product Guide

Vybrel is a state-of-the-art trade finance platform designed to streamline the lifecycle of receivables purchase, factoring, and supply chain finance. This document provides a comprehensive overview of how the system works and the features available to each stakeholder.

---

## 🛰️ Core System Workflow

The Vybrel platform facilitates the flow of capital from Funders to Borrowers, secured by invoices and supported by data-driven credit risk assessment.

1.  **Onboarding**: Borrowers and Funders complete KYC/KYB and document uploading.
2.  **Facility Setup**: Originators establish credit limits and Master Service Agreements (MSAs) for Borrowers.
3.  **Invoice Submission**: Borrowers submit invoices manually or via AI-powered document parsing (OCR).
4.  **Verification**: Counterparties (Debtors) verify the validity of the invoices through a secure external portal.
5.  **Funding (Disbursement)**: Originators approve invoices and execute disbursements based on active funder limits.
6.  **Collection**: When the Counterparty pays, the Originator records the collection.
7.  **Settlement**: The system automatically calculates the waterfall (fees, yield, and principal) and issues settlement advices to all parties.

---

## 👥 Stakeholder Feature Matrix

### 🛠️ Vybrel Admin (Super Admin)
*   **Organization Management**: Create and manage the lifecycle of Originator, Broker, and Funder firms.
*   **User Governance**: Global user administration and role assignment across the entire platform.
*   **Product Configuration**: Define the core trade finance products (e.g., Receivables Purchase, Reverse Factoring) and global parameters.
*   **Audit & Oversight**: Access to global audit logs and AI analysis status for platform-wide troubleshooting.
*   **Workflow Studio**: Configure automated backend processes and system integrations.

### 🏛️ Originator (The Ops Hub)
*   **Borrower Lifecycle Management**: Manage the full onboarding, document vault, and credit quality of Borrowers.
*   **Credit Committee (CC)**: 
    *   **Credit Memos**: Generate and review detailed credit analysis.
    *   **CC Approval Workflow**: Multi-stage approval process for credit facilities.
*   **Counterparty Management**: Centralized database of debtors to monitor portfolio concentration.
*   **Lender Management**: Manage relationships with Funders, including MSA terms, base rates, and margins.
*   **Operations**:
    *   **Invoice Processing**: AI-assisted invoice entry and verification.
    *   **Disbursements**: Maker-checker guarded fund transfers with real-time limit checks.
    *   **Repayments**: Manage incoming debtor funds with same-day accounting.
*   **Collections & Settlements**: 
    *   **Waterfall UI**: Visualize how every dollar is split between stakeholders.
    *   **Settlement Advices**: Automated generation of payment instructions for Funders and Borrowers.
*   **Branding (White-Label)**: Configure themes, logos, and portal aesthetics for a custom borrower experience.

### 💰 Funder (The Capital Provider)
*   **KYC Onboarding**: Self-service compliance portal for entity verification (Entity Info, AML/Compliance, Banking, Docs).
*   **Marketplace**: View available funding opportunities and participate in invoice financing.
*   **Portfolio Tracking**: Real-time dashboard of active positions, yield performance, and upcoming settlements.
*   **Settlement Management**: Receive automated settlement advices with clear breakdowns of principal and yield returns.

### 🤝 Broker
*   **Portfolio Branding**: White-label the platform for sub-clients (Borrowers) while maintaining centralized oversight.
*   **Delegated Management**: Manage a subset of Borrowers, including their documents, invoices, and contracts.
*   **Reporting**: Dedicated broker-level reports on volume and fee generation.
*   **Fee Configuration**: Set specific margin and commission structures per client.

### 🏭 Borrower
*   **Self-Onboarding**: Guided wizard to complete KYB questions and upload core financial documents.
*   **Invoice Submission Wizard**: 
    *   **AI Parsing**: Drag-and-drop invoices for automated field extraction.
    *   **Manual Entry**: Fast-form submission for routine invoices.
*   **Real-time Status**: Track invoices from "Submitted" to "Funded" to "Settled".
*   **Financial Reporting**: Access to borrowing history, cost of capital reports, and repayment statements.

### 🏢 Counterparty (The Debtor)
*   **Secure External Verification**: One-click verification links to confirm invoice validity without requiring a full platform login.
*   **Dashboard**: Visibility into outstanding payables and payment instructions to ensure funds reach the correct account.

---

## 🔒 Platform Integrity & Security

Vybrel is built on a "Trust but Verify" architecture:
*   **Maker-Checker Rule**: High-value actions (like disbursements and repayments) require multiple users: the person who creates the transaction cannot be the one who approves it.
*   **Real-time Limit Guards**: The system prevents disbursements that exceed predefined Borrower or Counterparty credit limits across all active funders.
*   **Data Isolation**: Robust Row-Level Security (RLS) ensures that data never leaks between competing organizations.
*   **Full Auditability**: Every sensitive action is timestamped and logged, providing an immutable trail for compliance and internal review.
*   **Auto-Supersede**: New contracts and MSAs automatically supersede old versions, ensuring operations always use the most current legal terms.
