import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 md:py-16">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <article className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground">
          <h1>Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: March 13, 2026</p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the Vybrel Invoice Financing Platform ("Platform"), you agree to be bound by these
            Terms of Service ("Terms"). If you do not agree, do not use the Platform.
          </p>

          <h2>2. Platform Description</h2>
          <p>
            Vybrel provides a multi-tenant digital platform enabling Originators, Borrowers, Funders, and
            Counterparties to participate in invoice financing transactions. The Platform facilitates onboarding,
            KYC/AML compliance, credit assessment, deal origination, disbursement, and collections.
          </p>

          <h2>3. User Obligations</h2>
          <h3>3.1 Account Security</h3>
          <ul>
            <li>You must maintain the confidentiality of your login credentials</li>
            <li>You must enable and maintain two-factor authentication</li>
            <li>You must immediately notify us of any unauthorized access</li>
            <li>You are responsible for all activity under your account</li>
          </ul>

          <h3>3.2 Accurate Information</h3>
          <ul>
            <li>You must provide accurate, current, and complete information</li>
            <li>You must promptly update information when it changes</li>
            <li>Providing false or misleading information may result in account termination</li>
          </ul>

          <h3>3.3 Compliance</h3>
          <ul>
            <li>You must comply with all applicable laws and regulations</li>
            <li>You must not use the Platform for money laundering, fraud, or any illegal activity</li>
            <li>You must cooperate with KYC/AML verification procedures</li>
          </ul>

          <h2>4. Financial Transactions</h2>
          <p>
            All financial transactions on the Platform are subject to two-factor authentication verification.
            Transaction approvals are final once confirmed. Vybrel is not liable for transactions authorized
            with valid credentials and MFA verification.
          </p>

          <h2>5. Confidentiality</h2>
          <p>
            All non-public information shared through the Platform (including financial data, business terms,
            and transaction details) is confidential. Users agree to maintain strict confidentiality and not
            disclose information to unauthorized third parties.
          </p>

          <h2>6. Intellectual Property</h2>
          <p>
            The Platform, its features, design, and content are owned by Vybrel and protected by intellectual
            property laws. Users are granted a limited, non-exclusive, non-transferable license to use the
            Platform for its intended purpose.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Vybrel's total liability for any claim arising from use
            of the Platform shall not exceed the fees paid by you in the 12 months preceding the claim.
            Vybrel is not liable for indirect, incidental, or consequential damages.
          </p>

          <h2>8. Service Availability</h2>
          <p>
            We strive for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance
            will be communicated in advance. We are not liable for losses due to service interruptions
            beyond our control.
          </p>

          <h2>9. Termination</h2>
          <p>
            We may suspend or terminate accounts for breach of these Terms, suspected fraud, or regulatory
            requirements. Upon termination, access ceases but data retention obligations continue per our
            Privacy Policy and applicable regulations.
          </p>

          <h2>10. Dispute Resolution</h2>
          <p>
            Disputes arising from these Terms shall be resolved through good-faith negotiation first,
            then mediation, and finally binding arbitration under the rules of the London Court of
            International Arbitration (LCIA). Governing law: England and Wales.
          </p>

          <h2>11. Amendments</h2>
          <p>
            We may update these Terms with 30 days' written notice. Continued use after the effective
            date constitutes acceptance. Material changes will be highlighted in-platform and via email.
          </p>

          <h2>12. Contact</h2>
          <p>
            For questions about these Terms:<br />
            Email: <strong>legal@vybrel.com</strong><br />
            Address: Vybrel Limited, London, United Kingdom
          </p>
        </article>
      </div>
    </div>
  );
}
