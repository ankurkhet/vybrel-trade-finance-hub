// send-message-email
// Called best-effort from Messages.tsx when a new in-app message is sent.
// Sends an email notification to the recipient via Resend.
// Errors are non-blocking — the caller silently ignores them.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const { recipient_id, sender_name, preview } = await req.json();

    if (!recipient_id || !sender_name) {
      return new Response(
        JSON.stringify({ error: "recipient_id and sender_name are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch recipient's email from profiles (id = auth.users.id after Arch Fix 1)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", recipient_id)
      .maybeSingle();

    if (profileErr || !profile?.email) {
      console.warn("[send-message-email] Recipient profile not found:", recipient_id);
      return new Response(
        JSON.stringify({ skipped: true, reason: "recipient_not_found" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.warn("[send-message-email] RESEND_API_KEY not set — skipping email delivery");
      return new Response(
        JSON.stringify({ skipped: true, reason: "no_api_key" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://app.vybrel.com";
    const recipientName = profile.full_name || "there";
    const safePreview = (preview || "").slice(0, 200);

    const emailPayload = {
      from: "Vybrel Platform <noreply@vybrel.com>",
      to: [profile.email],
      subject: `New message from ${sender_name}`,
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
                        <strong>${sender_name}</strong> sent you a message on Vybrel:
                      </p>
                      <div style="background:#f5f3ff;border-left:3px solid #6366f1;border-radius:4px;
                        padding:14px 18px;margin-bottom:24px;">
                        <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">
                          ${safePreview}
                        </p>
                      </div>
                      <a href="${appUrl}/messages"
                        style="display:inline-block;background:#4f46e5;color:#ffffff;
                        padding:11px 22px;border-radius:6px;text-decoration:none;
                        font-size:14px;font-weight:600;">
                        Open Messages
                      </a>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
                      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                        You are receiving this notification because you have an account on Vybrel.<br />
                        Log in to manage your notification preferences.
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
      console.error("[send-message-email] Resend API error:", resendRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Email delivery failed", detail: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await resendRes.json();
    console.log("[send-message-email] Email sent to", profile.email, "id:", result.id);

    return new Response(
      JSON.stringify({ sent: true, email_id: result.id }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-message-email] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
