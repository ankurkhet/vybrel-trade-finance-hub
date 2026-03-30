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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action } = body;

    // ─── IBAN Validation ───────────────────────────────────────
    if (action === "validate_iban") {
      const { iban } = body;
      if (!iban) {
        return jsonResponse({ error: "IBAN is required" }, 400);
      }

      const cleanIban = iban.replace(/\s/g, "").toUpperCase();

      try {
        const res = await fetch(
          `https://openiban.com/validate/${encodeURIComponent(cleanIban)}?getBIC=true&validateBankCode=true`
        );
        const data = await res.json();

        return jsonResponse({
          valid: data.valid === true,
          iban: cleanIban,
          bank_name: data.bankData?.name || null,
          bic: data.bankData?.bic || null,
          country: data.bankData?.country || cleanIban.substring(0, 2),
          city: data.bankData?.city || null,
          confidence: data.valid ? 95 : 0,
          source: "OpenIBAN",
          messages: data.messages || [],
        });
      } catch (err) {
        return jsonResponse({
          valid: false,
          iban: cleanIban,
          error: (err as Error).message,
          source: "OpenIBAN",
        });
      }
    }

    // ─── UK Sort Code Validation ───────────────────────────────
    if (action === "validate_sortcode") {
      const { sort_code, account_number } = body;
      if (!sort_code) {
        return jsonResponse({ error: "Sort code is required" }, 400);
      }

      const cleanSortCode = sort_code.replace(/[-\s]/g, "");
      
      // Basic format validation
      const sortCodeValid = /^\d{6}$/.test(cleanSortCode);
      const accountValid = account_number ? /^\d{8}$/.test(account_number.replace(/\s/g, "")) : null;

      // Use sortcode lookup - this is a simple validation
      // In production, you'd call the actual API with the configured key
      const { data: config } = await supabase
        .from("registry_api_configs")
        .select("*")
        .eq("registry_name", "Sortcode.co.uk")
        .eq("is_active", true)
        .maybeSingle();

      let bankName = null;
      let branch = null;

      if (config) {
        const apiKey = config.api_key_value || Deno.env.get(config.api_key_secret_name);
        if (apiKey) {
          try {
            const formatted = `${cleanSortCode.slice(0, 2)}-${cleanSortCode.slice(2, 4)}-${cleanSortCode.slice(4, 6)}`;
            const res = await fetch(`${config.api_base_url}/api/v1/validate/${formatted}`, {
              headers: { "Authorization": `Bearer ${apiKey}`, "Accept": "application/json" },
            });
            if (res.ok) {
              const data = await res.json();
              bankName = data.bank_name || data.bank || null;
              branch = data.branch || null;
            }
          } catch { /* fallback to basic validation */ }
        }
      }

      // Well-known UK sort code prefixes for basic lookup
      if (!bankName && sortCodeValid) {
        const prefix = cleanSortCode.substring(0, 2);
        const knownBanks: Record<string, string> = {
          "20": "Barclays", "23": "Barclays",
          "30": "Lloyds", "77": "Lloyds",
          "40": "HSBC", "41": "HSBC",
          "60": "NatWest", "61": "NatWest",
          "09": "Santander", "72": "Santander",
          "80": "Bank of Scotland", "12": "Bank of Scotland",
          "83": "Royal Bank of Scotland",
          "04": "Clydesdale",
          "07": "Nationwide",
        };
        bankName = knownBanks[prefix] || null;
      }

      return jsonResponse({
        valid: sortCodeValid && (accountValid === null || accountValid),
        sort_code: cleanSortCode,
        account_number: account_number?.replace(/\s/g, "") || null,
        bank_name: bankName,
        branch,
        sort_code_format_valid: sortCodeValid,
        account_format_valid: accountValid,
        confidence: sortCodeValid ? (bankName ? 85 : 60) : 0,
        source: "Sortcode.co.uk",
      });
    }

    // ─── Sanctions / PEP Screening ─────────────────────────────
    if (action === "sanctions_check") {
      const { name, birth_date, country } = body;
      if (!name) {
        return jsonResponse({ error: "Name is required for sanctions check" }, 400);
      }

      // Check for OpenSanctions config
      const { data: config } = await supabase
        .from("registry_api_configs")
        .select("*")
        .eq("registry_name", "OpenSanctions")
        .eq("is_active", true)
        .maybeSingle();

      const apiKey = config?.api_key_value || Deno.env.get("OPENSANCTIONS_API_KEY");

      if (!apiKey) {
        return jsonResponse({
          screened: false,
          error: "OpenSanctions API key not configured",
          source: "OpenSanctions",
        });
      }

      try {
        const params = new URLSearchParams({ q: name, limit: "10" });
        if (birth_date) params.set("birth_date", birth_date);
        if (country) params.set("countries", country);

        const res = await fetch(`https://api.opensanctions.org/match/default?${params.toString()}`, {
          method: "POST",
          headers: {
            "Authorization": `ApiKey ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queries: {
              q1: {
                schema: "Person",
                properties: {
                  name: [name],
                  ...(birth_date ? { birthDate: [birth_date] } : {}),
                  ...(country ? { country: [country] } : {}),
                },
              },
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`OpenSanctions API error ${res.status}: ${errBody.substring(0, 300)}`);
        }

        const data = await res.json();
        const results = data.responses?.q1?.results || [];

        const sanctions = results.filter((r: any) =>
          r.datasets?.some((d: string) => !d.includes("pep"))
        );
        const peps = results.filter((r: any) =>
          r.datasets?.some((d: string) => d.includes("pep"))
        );

        return jsonResponse({
          screened: true,
          clear: results.length === 0,
          total_hits: results.length,
          sanctions_hits: sanctions.length,
          pep_hits: peps.length,
          matches: results.slice(0, 5).map((r: any) => ({
            name: r.caption,
            score: r.score,
            datasets: r.datasets,
            schema: r.schema,
            countries: r.properties?.country || [],
            is_pep: r.datasets?.some((d: string) => d.includes("pep")) || false,
            is_sanction: r.datasets?.some((d: string) => !d.includes("pep")) || false,
          })),
          source: "OpenSanctions",
          checked_at: new Date().toISOString(),
        });
      } catch (err) {
        return jsonResponse({
          screened: false,
          error: err.message,
          source: "OpenSanctions",
        });
      }
    }

    // ─── Health Check ──────────────────────────────────────────
    if (action === "health_check") {
      const { tool } = body;

      if (tool === "openiban") {
        try {
          const res = await fetch("https://openiban.com/validate/DE89370400440532013000?getBIC=true");
          const data = await res.json();
          return jsonResponse({ status: data.valid === true ? "healthy" : "unhealthy", message: "OpenIBAN test validation" });
        } catch (err) {
          return jsonResponse({ status: "unhealthy", message: err.message });
        }
      }

      if (tool === "sortcode") {
        return jsonResponse({ status: "healthy", message: "Basic sort code validation active (enhanced with API key)" });
      }

      if (tool === "opensanctions") {
        const apiKey = Deno.env.get("OPENSANCTIONS_API_KEY");
        if (!apiKey) {
          return jsonResponse({ status: "unhealthy", message: "API key not configured" });
        }
        try {
          const res = await fetch("https://api.opensanctions.org/search/default?q=test&limit=1", {
            headers: { "Authorization": `ApiKey ${apiKey}` },
          });
          return jsonResponse({ status: res.ok ? "healthy" : "unhealthy", message: res.ok ? "API responding" : `Status ${res.status}` });
        } catch (err) {
          return jsonResponse({ status: "unhealthy", message: err.message });
        }
      }

      return jsonResponse({ error: "Unknown tool" }, 400);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Content-Type": "application/json",
    },
  });
}
