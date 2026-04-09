import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function fetchFromFRED(seriesId: string, apiKey: string): Promise<number | null> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const val = data?.observations?.[0]?.value;
    return val && val !== "." ? parseFloat(val) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("Fetching market rates...");

    // Static fallback rates
    let sofr = 5.31;
    let sonia = 5.20;
    let euribor = 3.89;
    let boe = 5.25;

    // Try live FRED API if key is configured
    const fredKey = Deno.env.get("FRED_API_KEY");
    if (fredKey) {
      console.log("FRED_API_KEY found, fetching live rates...");
      const [liveSofr, liveSonia] = await Promise.all([
        fetchFromFRED("SOFR", fredKey),
        fetchFromFRED("IUDSOIA", fredKey), // SONIA series
      ]);
      if (liveSofr !== null) sofr = liveSofr;
      if (liveSonia !== null) sonia = liveSonia;
      console.log(`Live rates: SOFR=${sofr}, SONIA=${sonia}`);
    } else {
      console.log("No FRED_API_KEY, using static fallback rates");
    }

    const rates = [
      { rate_name: "SOFR", rate_value: sofr },
      { rate_name: "SONIA", rate_value: sonia },
      { rate_name: "EURIBOR-3M", rate_value: euribor },
      { rate_name: "BOE", rate_value: boe },
      { rate_name: "Fixed", rate_value: 0.0 },
    ];

    const fetchedAt = new Date().toISOString();
    for (const r of rates) {
      const { error } = await supabase
        .from("reference_rates")
        .upsert(
          {
            rate_name: r.rate_name,
            rate_value: r.rate_value,
            as_of_date: fetchedAt,
            source: fredKey ? "FRED API" : "static_fallback",
          },
          { onConflict: "rate_name" }
        );

      if (error) {
        console.error(`Error updating ${r.rate_name}:`, error);
      }
    }

    // Record invocation in platform_api_configs for admin visibility
    await supabase
      .from("platform_api_configs")
      .update({ last_invoked_at: fetchedAt, health_status: "healthy" })
      .eq("api_name", "fetch-market-rates");

    return new Response(JSON.stringify({ success: true, rates, source: fredKey ? "fred_api" : "static_fallback", fetched_at: fetchedAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
