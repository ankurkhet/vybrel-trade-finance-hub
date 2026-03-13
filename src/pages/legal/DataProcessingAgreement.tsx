import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DataProcessingAgreement() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-16">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <article className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
          <h1>Data Processing Agreement</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 13, 2026</p>

          <h2>1. Scope and Purpose</h2>
          <p>
            This Data Processing Agreement ("DPA") governs the processing of personal data by Vybrel
            ("Processor") on behalf of Originators and their clients ("Controllers") through the
            Vybrel Invoice Financing Platform.
          </p>

          <h2>2. Definitions</h2>
          <ul>
            <li><strong>"Personal Data"</strong> — any information relating to an identified or identifiable natural person</li>
            <li><strong>"Processing"</strong> — any operation performed on personal data (collection, storage, use, disclosure, erasure)</li>
            <li><strong>"Data Subject"</strong> — the individual whose personal data is processed</li>
            <li><strong>"Sub-processor"</strong> — any third party engaged by the Processor to process personal data</li>
          </ul>

          <h2>3. Data Processing Details</h2>
          <h3>3.1 Categories of Data Subjects</h3>
          <ul>
            <li>Borrower company directors and authorized signatories</li>
            <li>Funder representatives</li>
            <li>Counterparty contacts</li>
            <li>Originator staff and administrators</li>
          </ul>

          <h3>3.2 Types of Personal Data</h3>
          <ul>
            <li>Identity data (name, date of birth, nationality, government ID)</li>
            <li>Contact data (email, phone, address)</li>
            <li>Financial data (bank details, transaction records)</li>
            <li>KYC/AML screening data</li>
            <li>Technical data (IP address, device info, session logs)</li>
          </ul>

          <h3>3.3 Processing Activities</h3>
          <ul>
            <li>User account management and authentication</li>
            <li>KYC/AML compliance screening</li>
            <li>Credit assessment and deal processing</li>
            <li>Transaction management and disbursement</li>
            <li>Collections and repayment tracking</li>
            <li>Audit logging and compliance reporting</li>
          </ul>

          <h2>4. Processor Obligations</h2>
          <ul>
            <li>Process personal data only on documented instructions from the Controller</li>
            <li>Ensure personnel are bound by confidentiality obligations</li>
            <li>Implement appropriate technical and organizational security measures</li>
            <li>Engage sub-processors only with prior written authorization</li>
            <li>Assist the Controller in fulfilling data subject rights requests</li>
            <li>Delete or return personal data upon termination of the agreement</li>
            <li>Make available all information necessary for compliance audits</li>
          </ul>

          <h2>5. Security Measures</h2>
          <p>The Processor implements the following measures:</p>
          <ul>
            <li>AES-256 encryption at rest, TLS 1.3 in transit</li>
            <li>Field-level encryption for PII and financial data</li>
            <li>Role-based access control with principle of least privilege</li>
            <li>Multi-factor authentication for all platform access</li>
            <li>Automated session timeout and concurrent session limits</li>
            <li>Comprehensive audit logging with tamper-proof storage</li>
            <li>Regular penetration testing (minimum annually)</li>
            <li>24/7 monitoring and incident response procedures</li>
          </ul>

          <h2>6. Sub-processors</h2>
          <p>
            The Processor maintains an up-to-date list of sub-processors. The Controller will be
            notified of any intended changes to sub-processors with at least 30 days' notice,
            during which the Controller may object.
          </p>

          <h2>7. Data Breach Notification</h2>
          <p>
            The Processor shall notify the Controller without undue delay (and within 24 hours)
            after becoming aware of a personal data breach, providing:
          </p>
          <ul>
            <li>Nature of the breach and categories of data affected</li>
            <li>Approximate number of data subjects affected</li>
            <li>Likely consequences of the breach</li>
            <li>Measures taken or proposed to mitigate the breach</li>
          </ul>

          <h2>8. International Transfers</h2>
          <p>
            Personal data shall not be transferred outside the EEA/UK without appropriate safeguards,
            including Standard Contractual Clauses (SCCs) approved by the European Commission or
            UK Information Commissioner.
          </p>

          <h2>9. Data Subject Rights</h2>
          <p>
            The Processor shall assist the Controller in responding to data subject requests including
            access, rectification, erasure, restriction, portability, and objection, within the
            timeframes required by GDPR (30 days).
          </p>

          <h2>10. Term and Termination</h2>
          <p>
            This DPA remains in effect for the duration of the service agreement. Upon termination,
            the Processor shall delete all personal data within 90 days, unless retention is required
            by law (e.g., AML regulations requiring 5-7 year retention).
          </p>

          <h2>11. Governing Law</h2>
          <p>
            This DPA is governed by the laws of England and Wales, subject to the mandatory provisions
            of GDPR and the UK Data Protection Act 2018.
          </p>
        </article>
      </div>
    </div>
  );
}
