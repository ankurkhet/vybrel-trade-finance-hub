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

// Fetch Bank of England Official Bank Rate from BOE public API
async function fetchBoeRate(): Promise<number | null> {
  try {
    // BOE Statistical Interactive Database CSV endpoint for Official Bank Rate (IUDBEDR series)
    const url = `https://www.bankofengland.co.uk/boeapps/database/_iadb-FromShowColumns.asp?csv.x=yes&SeriesCodes=IUDBEDR&CSVF=TN&UsingCodes=Y&VPD=Y&NoHeader=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const text = await res.text();
    // CSV format: date,value on each line, newest last. Parse all lines and get last valid value.
    const lines = text.trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const parts = lines[i].split(",");
      if (parts.length >= 2) {
        const val = parseFloat(parts[parts.length - 1].trim().replace('"', ''));
        if (!isNaN(val)) return val;
      }
    }
    return null;
  } catch (e) {
    console.error("BOE API error:", (e as Error).message);
    return null;
  }
}

// Fetch EURIBOR 3M from ECB public API (no key required)
async function fetchEuribor3M(): Promise<number | null> {
  try {
    const url = `https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT0.MM.EURIBOR3MD_.HSTA?lastNObservations=1&format=jsondata`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    const obs = data?.dataSets?.[0]?.series?.["0:0:0:0:0:0:0"]?.observations;
    if (!obs) return null;
    const keys = Object.keys(obs).sort((a, b) => parseInt(b) - parseInt(a));
    return keys.length > 0 ? parseFloat(obs[keys[0]][0]) : null;
  } catch (e) {
    console.error("ECB EURIBOR error:", (e as Error).message);
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

    // Updated static fallback rates (as of early 2026 estimates — will be overridden by live fetch)
    let sofr = 4.30;
    let sonia = 4.45;
    let euribor = 2.65;
    let boe = 4.50;  // BOE cut rates through 2025; estimate for early 2026

    // Try live BOE API (free, no key required)
    const liveBoe = await fetchBoeRate();
    if (liveBoe !== null) {
      boe = liveBoe;
      console.log(`Live BOE rate: ${boe}%`);
    } else {
      console.log(`BOE API unavailable, using fallback: ${boe}%`);
    }

    // Try live EURIBOR from ECB (free, no key required)
    const liveEuribor = await fetchEuribor3M();
    if (liveEuribor !== null) {
      euribor = liveEuribor;
      console.log(`Live EURIBOR 3M: ${euribor}%`);
    } else {
      console.log(`ECB API unavailable, using fallback: ${euribor}%`);
    }

    // Try live FRED API if key is configured (for SOFR and SONIA)
    const fredKey = Deno.env.get("FRED_API_KEY");
    if (fredKey) {
      console.log("FRED_API_KEY found, fetching SOFR/SONIA...");
      const [liveSofr, liveSonia] = await Promise.all([
        fetchFromFRED("SOFR", fredKey),
        fetchFromFRED("IUDSOIA", fredKey), // SONIA series
      ]);
      if (liveSofr !== null) sofr = liveSofr;
      if (liveSonia !== null) sonia = liveSonia;
      console.log(`Live rates: SOFR=${sofr}, SONIA=${sonia}`);
    } else {
      console.log("No FRED_API_KEY, using fallback rates for SOFR/SONIA");
    }

    const sources: Record<string, string> = {
      BOE: liveBoe !== null ? "boe_api" : "static_fallback",
      EURIBOR: liveEuribor !== null ? "ecb_api" : "static_fallback",
      SOFR: fredKey ? "fred_api" : "static_fallback",
      SONIA: fredKey ? "fred_api" : "static_fallback",
    };

    const rates = [
      { rate_name: "SOFR", rate_value: sofr },
      { rate_name: "SONIA", rate_value: sonia },
      { rate_name: "EURIBOR-3M", rate_value: euribor },
      { rate_name: "BOE", rate_value: boe },
      { rate_name: "ESTR", rate_value: euribor - 0.10 }, // ESTR typically ~10bps below EURIBOR
      { rate_name: "Fixed", rate_value: 0.0 },
    ];

    const fetchedAt = new Date().toISOString();
    for (const r of rates) {
      const rateSource = sources[r.rate_name] || (fredKey ? "FRED API" : "static_fallback");
      const { error } = await supabase
        .from("reference_rates")
        .upsert(
          {
            rate_name: r.rate_name,
            rate_value: r.rate_value,
            as_of_date: fetchedAt,
            source: rateSource,
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

    return new Response(JSON.stringify({ success: true, rates, sources, fetched_at: fetchedAt }), {
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
