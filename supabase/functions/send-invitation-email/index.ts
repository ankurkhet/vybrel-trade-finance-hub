// send-invitation-email
// Sends a Vybrel platform invitation email to a newly onboarded originator contact.
// Called from Organizations.tsx handleCreate for each contact person.
// Reads RESEND_API_KEY from env, falling back to platform_secrets table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Health-check mode: invoked with empty body by platform API health checker
    if (!body.email) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      let apiKey = Deno.env.get("RESEND_API_KEY");
      if (!apiKey) {
        const { data } = await supabase.from("platform_secrets").select("value").eq("key", "RESEND_API_KEY").maybeSingle();
        apiKey = data?.value;
      }
      if (!apiKey) {
        return new Response(
          JSON.stringify({ healthy: false, reason: "RESEND_API_KEY not configured" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ healthy: true, mode: "health_check" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, full_name, org_name, invite_url } = body;

    if (!email || !invite_url) {
      return new Response(
        JSON.stringify({ error: "email and invite_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      const { data } = await supabase.from("platform_secrets").select("value").eq("key", "RESEND_API_KEY").maybeSingle();
      apiKey = data?.value;
    }

    if (!apiKey) {
      console.warn("[send-invitation-email] RESEND_API_KEY not configured — skipping email");
      return new Response(
        JSON.stringify({ skipped: true, reason: "RESEND_API_KEY not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipientName = full_name || "there";
    const orgDisplay = org_name || "your organisation";

    const emailPayload = {
      from: "Vybrel Platform <noreply@vybrel.com>",
      to: [email],
      subject: `You've been invited to join ${orgDisplay} on Vybrel`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background:#f9fafb;font-family:sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:40px 16px;">
                <table width="520" cellpadding="0" cellspacing="0"
                  style="background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background:#4f46e5;padding:20px 32px;">
                      <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">
                        Vybrel
                      </span>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:32px;">
                      <p style="margin:0 0 8px;font-size:15px;color:#111827;">
                        Hi ${recipientName},
                      </p>
                      <p style="margin:0 0 20px;font-size:15px;color:#374151;">
                        You've been invited to join <strong>${orgDisplay}</strong> on the Vybrel Trade Finance Platform as an <strong>Originator Admin</strong>.
                      </p>
                      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">
                        Click the button below to accept your invitation and set up your account. This link will expire in 7 days.
                      </p>
                      <a href="${invite_url}"
                        style="display:inline-block;background:#4f46e5;color:#ffffff;
                        padding:12px 28px;border-radius:6px;text-decoration:none;
                        font-size:14px;font-weight:600;letter-spacing:0.2px;">
                        Accept Invitation
                      </a>
                      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
                        Or copy this link into your browser:<br />
                        <a href="${invite_url}" style="color:#6366f1;word-break:break-all;">${invite_url}</a>
                      </p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
                      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                        If you did not expect this invitation, you can safely ignore this email.<br />
                        Vybrel · Trade Finance Platform
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>`,
    };

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error("[send-invitation-email] Resend error:", resendRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Email delivery failed", detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await resendRes.json();
    console.log("[send-invitation-email] Sent to", email, "id:", result.id);

    return new Response(
      JSON.stringify({ sent: true, email_id: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[send-invitation-email] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
