// notify-counterparty
// Required Supabase secrets (set via `supabase secrets set`):
//   RESEND_API_KEY  — Resend API key for email delivery (from resend.com)
//   APP_URL         — Public app URL, e.g. https://app.vybrel.com
// Without RESEND_API_KEY the function still runs but skips email delivery.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "invoice_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the invoice with borrower details
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*, borrowers(company_name)")
      .eq("id", invoice_id)
      .single();

    if (invError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!invoice.requires_counterparty_acceptance || !invoice.counterparty_email) {
      return new Response(
        JSON.stringify({ error: "Invoice does not require counterparty acceptance or no email set" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the verification URL
    const siteUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", "").replace("https://", "");
    // Use the frontend URL from the referrer or a default
    const frontendUrl = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || `https://${siteUrl}.lovable.app`;
    const verifyUrl = `${frontendUrl}/verify-invoice?token=${invoice.acceptance_token}`;

    const productLabels: Record<string, string> = {
      receivables_purchase: "Receivables Purchase",
      reverse_factoring: "Reverse Factoring",
      payables_finance: "Payables Finance",
    };

    const productLabel = productLabels[invoice.product_type] || invoice.product_type;
    const supplierName = (invoice.borrowers as any)?.company_name || "a supplier";
    const counterpartyName = invoice.counterparty_name || "Counterparty";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice Verification Required</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#ffffff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="display:inline-block;width:56px;height:56px;background-color:#2563eb10;border-radius:50%;line-height:56px;font-size:24px;">📄</div>
        <h1 style="margin:16px 0 8px;font-size:22px;color:#111827;">Invoice Verification Required</h1>
        <p style="margin:0;color:#6b7280;font-size:14px;">You've been asked to verify an invoice</p>
      </div>

      <p style="color:#374151;font-size:15px;line-height:1.6;">
        Dear ${counterpartyName},
      </p>
      <p style="color:#374151;font-size:15px;line-height:1.6;">
        <strong>${supplierName}</strong> has submitted an invoice that requires your verification as part of a <strong>${productLabel}</strong> transaction on the Vybrel platform.
      </p>

      <div style="background:#f3f4f6;border-radius:8px;padding:20px;margin:24px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Invoice Number</td>
            <td style="padding:6px 0;text-align:right;color:#111827;font-size:13px;font-weight:600;">${invoice.invoice_number}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Amount</td>
            <td style="padding:6px 0;text-align:right;color:#111827;font-size:13px;font-weight:600;">${invoice.currency} ${Number(invoice.amount).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Due Date</td>
            <td style="padding:6px 0;text-align:right;color:#111827;font-size:13px;font-weight:600;">${new Date(invoice.due_date).toLocaleDateString("en-GB")}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">Product Type</td>
            <td style="padding:6px 0;text-align:right;color:#111827;font-size:13px;font-weight:600;">${productLabel}</td>
          </tr>
        </table>
      </div>

      <p style="color:#374151;font-size:15px;line-height:1.6;">
        Please review the invoice details and confirm or reject it using the button below:
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${verifyUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">
          Review &amp; Verify Invoice
        </a>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:20px;">
        This is an automated message from Vybrel Invoice Financing Platform.<br>
        If you did not expect this email, please ignore it.
      </p>
    </div>
  </div>
</body>
</html>`;

    console.log(`[notify-counterparty] Sending verification email to ${invoice.counterparty_email} for invoice ${invoice.invoice_number}`);

    // Attempt to send via Resend if API key is configured
    let resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      const { data: secretData } = await supabase
        .from('platform_secrets')
        .select('value')
        .eq('key', 'RESEND_API_KEY')
        .maybeSingle();
      if (secretData) resendApiKey = secretData.value;
    }
    
    let emailSent = false;
    let emailError: string | null = null;

    if (resendApiKey) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Vybrel Platform <noreply@vybrel.com>",
            to: [invoice.counterparty_email],
            subject: `Invoice Verification Required: ${invoice.invoice_number}`,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          emailSent = true;
          console.log(`[notify-counterparty] Email sent via Resend to ${invoice.counterparty_email}`);
        } else {
          const errBody = await resendRes.text();
          emailError = `Resend API error (${resendRes.status}): ${errBody}`;
          console.error(`[notify-counterparty] ${emailError}`);
        }
      } catch (sendErr: any) {
        emailError = `Email send failed: ${sendErr.message}`;
        console.error(`[notify-counterparty] ${emailError}`);
      }
    } else {
      console.log("[notify-counterparty] RESEND_API_KEY not set — email logged but not sent");
    }

    // Store notification record in metadata for tracking
    await supabase
      .from("invoices")
      .update({
        metadata: {
          notification_sent_at: new Date().toISOString(),
          notification_email: invoice.counterparty_email,
          verification_url: verifyUrl,
          email_sent: emailSent,
        },
      } as any)
      .eq("id", invoice_id);

    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent
          ? `Verification email sent to ${invoice.counterparty_email}`
          : `Verification email prepared for ${invoice.counterparty_email} (not sent — RESEND_API_KEY not configured)`,
        email_sent: emailSent,
        email_error: emailError,
        verification_url: verifyUrl,
        counterparty_email: invoice.counterparty_email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[notify-counterparty] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
