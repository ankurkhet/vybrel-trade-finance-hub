import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-16">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <article className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
          <h1>Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 13, 2026</p>

          <h2>1. Introduction</h2>
          <p>
            Vybrel ("we", "our", "us") is committed to protecting the privacy and security of your personal data.
            This Privacy Policy explains how we collect, use, store, and protect your information when you use the
            Vybrel Invoice Financing Platform ("Platform"), in compliance with the General Data Protection Regulation
            (GDPR), the UK Data Protection Act 2018, and other applicable data protection laws.
          </p>

          <h2>2. Data Controller</h2>
          <p>
            Vybrel acts as the Data Controller for personal data processed through the Platform.
            For data processing inquiries, contact our Data Protection Officer at{" "}
            <strong>dpo@vybrel.com</strong>.
          </p>

          <h2>3. Data We Collect</h2>
          <h3>3.1 Identity & Contact Data</h3>
          <ul>
            <li>Full name, date of birth, nationality</li>
            <li>Email address, phone number, business address</li>
            <li>Government-issued identification documents (passport, national ID)</li>
          </ul>

          <h3>3.2 Financial Data</h3>
          <ul>
            <li>Bank account details, payment records</li>
            <li>Invoice data, transaction history, facility agreements</li>
            <li>Credit scores and financial assessments</li>
          </ul>

          <h3>3.3 Technical Data</h3>
          <ul>
            <li>IP address, browser type and version, device identifiers</li>
            <li>Login timestamps, session data, access logs</li>
            <li>Two-factor authentication method preferences</li>
          </ul>

          <h3>3.4 KYC/AML Compliance Data</h3>
          <ul>
            <li>Screening results from KYC/AML checks</li>
            <li>Beneficial ownership information</li>
            <li>Politically Exposed Person (PEP) and sanctions screening results</li>
          </ul>

          <h2>4. Legal Basis for Processing</h2>
          <p>We process your data under the following legal bases:</p>
          <ul>
            <li><strong>Contractual necessity</strong> — to provide invoice financing services</li>
            <li><strong>Legal obligation</strong> — to comply with AML/KYC, tax, and regulatory requirements</li>
            <li><strong>Legitimate interests</strong> — fraud prevention, platform security, analytics</li>
            <li><strong>Consent</strong> — for marketing communications and optional analytics</li>
          </ul>

          <h2>5. Data Retention</h2>
          <p>
            We retain personal data only as long as necessary for the purposes set out in this Policy:
          </p>
          <ul>
            <li><strong>Account data</strong>: Duration of the business relationship + 7 years</li>
            <li><strong>Transaction records</strong>: 7 years from transaction date (regulatory requirement)</li>
            <li><strong>KYC/AML records</strong>: 5 years after the end of the business relationship</li>
            <li><strong>Audit logs</strong>: 7 years</li>
            <li><strong>Marketing consent</strong>: Until consent is withdrawn</li>
          </ul>

          <h2>6. Your Rights (GDPR)</h2>
          <p>Under GDPR, you have the right to:</p>
          <ul>
            <li><strong>Access</strong> — Request a copy of your personal data</li>
            <li><strong>Rectification</strong> — Correct inaccurate personal data</li>
            <li><strong>Erasure</strong> — Request deletion of your data (subject to legal obligations)</li>
            <li><strong>Restriction</strong> — Restrict processing of your data</li>
            <li><strong>Portability</strong> — Receive your data in a machine-readable format</li>
            <li><strong>Object</strong> — Object to processing based on legitimate interests</li>
            <li><strong>Withdraw consent</strong> — Where processing is based on consent</li>
          </ul>
          <p>
            To exercise these rights, contact <strong>privacy@vybrel.com</strong> or use the Data Rights
            section in your account settings. We will respond within 30 days.
          </p>

          <h2>7. Data Security</h2>
          <p>We implement banking-grade security measures including:</p>
          <ul>
            <li>AES-256 encryption for data at rest</li>
            <li>TLS 1.3 for data in transit</li>
            <li>Field-level encryption for sensitive PII and financial data</li>
            <li>Multi-factor authentication for all users</li>
            <li>Session management with automatic timeout</li>
            <li>Comprehensive audit logging of all data access</li>
            <li>Regular penetration testing and security audits</li>
          </ul>

          <h2>8. International Transfers</h2>
          <p>
            Where personal data is transferred outside the EEA/UK, we ensure appropriate safeguards
            through Standard Contractual Clauses (SCCs) or adequacy decisions.
          </p>

          <h2>9. Third-Party Data Sharing</h2>
          <p>We may share data with:</p>
          <ul>
            <li>KYC/AML screening providers (under Data Processing Agreements)</li>
            <li>Credit reference agencies</li>
            <li>Payment processors</li>
            <li>Regulatory authorities (where legally required)</li>
          </ul>
          <p>We never sell your personal data to third parties.</p>

          <h2>10. Data Breach Notification</h2>
          <p>
            In the event of a personal data breach, we will notify the relevant supervisory authority
            within 72 hours and affected individuals without undue delay where the breach is likely
            to result in a high risk to their rights and freedoms.
          </p>

          <h2>11. Contact</h2>
          <p>
            For privacy-related inquiries:<br />
            Data Protection Officer: <strong>dpo@vybrel.com</strong><br />
            Supervisory Authority: You may lodge a complaint with the ICO (UK) or your local data protection authority.
          </p>
        </article>
      </div>
    </div>
  );
}
