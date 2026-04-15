import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // Platform health-check: called with empty body by RegistryApis health checker
    if (!action) {
      return json({ healthy: true, mode: "health_check" });
    }

    // Resolve client_id: prefer body param, then DB lookup, then env fallback
    const resolveClientId = async (): Promise<string | null> => {
      if (body.client_id) return body.client_id;

      // Try to read from registry_api_configs
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { data } = await supabase
          .from("registry_api_configs")
          .select("client_id")
          .ilike("registry_name", "%truelayer%")
          .not("client_id", "is", null)
          .limit(1)
          .single();
        if (data?.client_id) return data.client_id;
      } catch { /* ignore */ }

      return null;
    };

    // ─── Health check ───────────────────────────────────────────
    if (action === "health_check") {
      const clientSecret = Deno.env.get("TRUELAYER_CLIENT_SECRET");
      if (!clientSecret) {
        return json({ status: "unhealthy", message: "TRUELAYER_CLIENT_SECRET not configured" });
      }
      const clientId = await resolveClientId();
      if (!clientId) {
        return json({ status: "unhealthy", message: "TrueLayer Client ID not configured. Set it in the Registry edit modal." });
      }
      try {
        const token = await getAccessToken(clientId, clientSecret);
        if (token) {
          return json({ status: "healthy", message: "OAuth2 token obtained successfully" });
        }
        return json({ status: "unhealthy", message: "Failed to obtain OAuth2 token – check Client ID & Secret" });
      } catch (err) {
        return json({ status: "unhealthy", message: `Auth error: ${(err as Error).message}` });
      }
    }

    // ─── Name verification ──────────────────────────────────────
    if (action === "verify_name") {
      const { name, iban, sort_code, account_number } = body;

      if (!name) {
        return json({ error: "Missing required field: name" }, 400);
      }
      if (!iban && !sort_code) {
        return json({ error: "Provide either iban or sort_code + account_number" }, 400);
      }

      const clientSecret = Deno.env.get("TRUELAYER_CLIENT_SECRET");
      if (!clientSecret) {
        return json({ error: "TRUELAYER_CLIENT_SECRET not configured" }, 500);
      }

      const clientId = await resolveClientId();
      if (!clientId) {
        return json({ error: "TrueLayer Client ID not configured. Set it in the Registry edit modal." }, 500);
      }

      const token = await getAccessToken(clientId, clientSecret);
      if (!token) {
        return json({ error: "Failed to obtain TrueLayer access token" }, 500);
      }

      // Build verification request body
      const verifyBody: any = {
        name,
      };

      if (iban) {
        verifyBody.account_identifier = {
          type: "iban",
          iban: iban.replace(/\s/g, ""),
        };
      } else {
        verifyBody.account_identifier = {
          type: "sort_code_account_number",
          sort_code: sort_code.replace(/[-\s]/g, ""),
          account_number: account_number,
        };
      }

      console.log("TrueLayer verify request:", JSON.stringify(verifyBody));

      const verifyRes = await fetch(
        "https://api.truelayer-sandbox.com/verification/v1/verify",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(verifyBody),
        }
      );

      const verifyData = await verifyRes.json();
      console.log("TrueLayer verify response:", JSON.stringify(verifyData));

      if (!verifyRes.ok) {
        return json({
          result: "Unable to Verify",
          confidence: 0,
          error: verifyData.detail || verifyData.title || `API returned ${verifyRes.status}`,
          raw: verifyData,
        });
      }

      // Parse TrueLayer response
      const status = verifyData.status || verifyData.result;
      let result: string;
      let confidence: number;

      if (status === "match" || status === "full_match") {
        result = "Name Matches";
        confidence = 100;
      } else if (status === "partial_match") {
        result = "Name Matches";
        confidence = 70;
      } else if (status === "no_match" || status === "mismatch") {
        result = "Name Does Not Match";
        confidence = 100;
      } else {
        result = "Unable to Verify";
        confidence = 0;
      }

      // Optionally update registry health
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        await supabase
          .from("registry_api_configs")
          .update({
            health_status: "healthy",
            health_message: "Verification API responding",
            last_health_check: new Date().toISOString(),
          })
          .ilike("registry_name", "%truelayer%");
      } catch { /* non-critical */ }

      return json({
        result,
        confidence,
        status: status,
        verified_name: verifyData.name || name,
        raw: verifyData,
      });
    }

    return json({ error: "Invalid action. Use 'verify_name' or 'health_check'" }, 400);
  } catch (err) {
    console.error("TrueLayer function error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ─── OAuth2 Client Credentials ──────────────────────────────────────

async function getAccessToken(clientId: string, clientSecret: string): Promise<string | null> {
  const tokenRes = await fetch("https://auth.truelayer-sandbox.com/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "verification",
    }),
  });

  const tokenData = await tokenRes.json();
  console.log("TrueLayer token response status:", tokenRes.status);

  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("TrueLayer token error:", JSON.stringify(tokenData));
    return null;
  }

  return tokenData.access_token;
}

// ─── Helper ─────────────────────────────────────────────────────────

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
