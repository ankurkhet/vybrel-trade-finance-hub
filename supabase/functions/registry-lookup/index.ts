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

    // Health check for a specific registry
    if (action === "health_check") {
      const { registry_id } = body;
      const { data: config } = await supabase
        .from("registry_api_configs")
        .select("*")
        .eq("id", registry_id)
        .single();

      if (!config) {
        return new Response(JSON.stringify({ error: "Registry not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const apiKey = config.api_key_value || Deno.env.get(config.api_key_secret_name);
      let healthStatus = "unhealthy";
      let healthMessage = "API key not configured";

      console.log(`Health check for ${config.registry_name}: apiKey present=${!!apiKey}, from_db=${!!config.api_key_value}, key_prefix=${apiKey ? apiKey.substring(0, 8) + '...' : 'none'}`);

      if (apiKey) {
        try {
          // Try a simple request to verify the API key works
          const testUrl = getHealthCheckUrl(config.country_code, config.api_base_url);
          const testHeaders = getAuthHeaders(config.country_code, apiKey);
          console.log(`Health check URL: ${testUrl}`);
          console.log(`Auth header: ${JSON.stringify(Object.keys(testHeaders))}`);
          const res = await fetch(testUrl, { headers: testHeaders });

          const resBody = await res.text();
          console.log(`Health check response: status=${res.status}, body=${resBody.substring(0, 500)}`);

          if (res.ok || res.status === 200) {
            healthStatus = "healthy";
            healthMessage = "API responding normally";
          } else if (res.status === 401 || res.status === 403) {
            healthStatus = "unhealthy";
            healthMessage = `Authentication failed (${res.status}). Please verify the API key.`;
          } else {
            healthStatus = "unhealthy";
            healthMessage = `API returned status ${res.status}`;
          }
        } catch (err) {
          healthStatus = "unhealthy";
          healthMessage = `Connection error: ${err.message}`;
        }
      }

      await supabase
        .from("registry_api_configs")
        .update({
          health_status: healthStatus,
          health_message: healthMessage,
          last_health_check: new Date().toISOString(),
        })
        .eq("id", registry_id);

      return new Response(
        JSON.stringify({ status: healthStatus, message: healthMessage }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Company lookup
    const { borrower_id, organization_id, company_name, registration_number, country_code } = body;

    if (!borrower_id || !organization_id || !company_name || !country_code) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: borrower_id, organization_id, company_name, country_code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // EU/EEA countries that can fall back to Open BRIS
    const openBrisCountries = [
      "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
      "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
      "SI", "ES", "SE", "IS", "LI", "NO"
    ];

    // Find active registry for this country
    const { data: registries } = await supabase
      .from("registry_api_configs")
      .select("*")
      .eq("country_code", country_code)
      .eq("is_active", true);

    let activeRegistries = registries || [];

    // If no country-specific registry found, fall back to Open BRIS for EU/EEA countries
    if (activeRegistries.length === 0 && openBrisCountries.includes(country_code)) {
      const { data: brisRegistries } = await supabase
        .from("registry_api_configs")
        .select("*")
        .eq("country_code", "EU")
        .eq("is_active", true);
      
      if (brisRegistries && brisRegistries.length > 0) {
        console.log(`No country-specific registry for ${country_code}, falling back to Open BRIS`);
        activeRegistries = brisRegistries;
      }
    }

    if (activeRegistries.length === 0) {
      // Store a placeholder result indicating no registry available
      await supabase.from("registry_results").insert({
        borrower_id,
        organization_id,
        result_type: "company_profile",
        data: { message: `No active registry configured for country ${country_code}` },
        match_analysis: {},
      });

      return new Response(
        JSON.stringify({ message: `No active registry for country ${country_code}`, results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const registry of activeRegistries) {
      const apiKey = registry.api_key_value || Deno.env.get(registry.api_key_secret_name);
      if (!apiKey) {
        results.push({
          registry: registry.registry_name,
          error: `API key ${registry.api_key_secret_name} not configured`,
        });
        continue;
      }

      // Fetch company data based on country
      try {
        const companyData = await fetchCompanyData(
          registry,
          apiKey,
          company_name,
          registration_number,
          country_code
        );

        if (companyData) {
          // Get borrower's submitted data for comparison
          const { data: borrower } = await supabase
            .from("borrowers")
            .select("*")
            .eq("id", borrower_id)
            .single();

          // Store each result type
          for (const [resultType, data] of Object.entries(companyData)) {
            const matchAnalysis = analyzeMatch(resultType, data, borrower);

            await supabase.from("registry_results").insert({
              borrower_id,
              organization_id,
              registry_api_id: registry.id,
              result_type: resultType,
              data: data as any,
              match_analysis: matchAnalysis,
            });

            results.push({ registry: registry.registry_name, type: resultType, data });
          }
        }
      } catch (err) {
        results.push({ registry: registry.registry_name, error: err.message });

        // Update health status
        await supabase
          .from("registry_api_configs")
          .update({
            health_status: "unhealthy",
            health_message: err.message,
            last_health_check: new Date().toISOString(),
          })
          .eq("id", registry.id);
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getHealthCheckUrl(countryCode: string, baseUrl: string): string {
  switch (countryCode) {
    case "GB":
      return `${baseUrl}/search/companies?q=test&items_per_page=1`;
    case "DK":
      return `${baseUrl}?search=test&country=dk`;
    default:
      return baseUrl;
  }
}

function getAuthHeaders(countryCode: string, apiKey: string): Record<string, string> {
  switch (countryCode) {
    case "GB":
      return { Authorization: `Basic ${btoa(apiKey + ":")}` };
    case "FR":
      return { Authorization: `Bearer ${apiKey}` };
    default:
      return { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey };
  }
}

async function fetchCompanyData(
  registry: any,
  apiKey: string,
  companyName: string,
  registrationNumber?: string,
  lookupCountryCode?: string
): Promise<Record<string, any> | null> {
  const results: Record<string, any> = {};
  // Use the actual lookup country if this is an EU-wide registry
  const effectiveCountry = registry.country_code === "EU" ? (lookupCountryCode || "EU") : registry.country_code;
  const headers = getAuthHeaders(effectiveCountry, apiKey);

  switch (registry.country_code) {
    case "GB": {
      // Companies House API
      const searchParam = registrationNumber || companyName;
      const searchUrl = registrationNumber
        ? `${registry.api_base_url}/company/${registrationNumber}`
        : `${registry.api_base_url}/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=5`;

      const searchRes = await fetch(searchUrl, { headers });
      if (!searchRes.ok) throw new Error(`Companies House API error: ${searchRes.status}`);
      const searchData = await searchRes.json();

      if (registrationNumber) {
        results.company_profile = searchData;
      } else {
        results.company_profile = searchData;
      }

      // If we have a company number, fetch additional data
      const companyNumber = registrationNumber || searchData?.items?.[0]?.company_number;
      if (companyNumber) {
        if (registry.capabilities?.includes("directors")) {
          try {
            const officersRes = await fetch(`${registry.api_base_url}/company/${companyNumber}/officers`, { headers });
            if (officersRes.ok) results.directors = await officersRes.json();
          } catch { /* skip */ }
        }
        if (registry.capabilities?.includes("filing_history")) {
          try {
            const filingsRes = await fetch(`${registry.api_base_url}/company/${companyNumber}/filing-history?items_per_page=10`, { headers });
            if (filingsRes.ok) results.filing_history = await filingsRes.json();
          } catch { /* skip */ }
        }
        if (registry.capabilities?.includes("charges")) {
          try {
            const chargesRes = await fetch(`${registry.api_base_url}/company/${companyNumber}/charges`, { headers });
            if (chargesRes.ok) results.charges = await chargesRes.json();
          } catch { /* skip */ }
        }
        if (registry.capabilities?.includes("insolvency")) {
          try {
            const insolvencyRes = await fetch(`${registry.api_base_url}/company/${companyNumber}/insolvency`, { headers });
            if (insolvencyRes.ok) results.insolvency = await insolvencyRes.json();
          } catch { /* skip */ }
        }
      }
      break;
    }

    case "DK": {
      // CVR API
      const searchUrl = `${registry.api_base_url}?search=${encodeURIComponent(registrationNumber || companyName)}&country=dk`;
      const res = await fetch(searchUrl, { headers });
      if (!res.ok) throw new Error(`CVR API error: ${res.status}`);
      results.company_profile = await res.json();
      break;
    }

    case "EU": {
      // Open BRIS API - pass the actual country code for the lookup
      const countryParam = lookupCountryCode ? lookupCountryCode.toLowerCase() : "";
      const searchUrl = registrationNumber
        ? `${registry.api_base_url}/api/company/${countryParam}/${encodeURIComponent(registrationNumber)}`
        : `${registry.api_base_url}/api/search?q=${encodeURIComponent(companyName)}&country=${countryParam}`;
      
      console.log(`Open BRIS lookup: ${searchUrl} for country ${lookupCountryCode}`);
      const res = await fetch(searchUrl, { headers });
      if (!res.ok) throw new Error(`Open BRIS API error: ${res.status}`);
      results.company_profile = await res.json();
      break;
    }

    default: {
      // Generic - try a search endpoint
      const searchUrl = `${registry.api_base_url}/search?q=${encodeURIComponent(registrationNumber || companyName)}`;
      try {
        const res = await fetch(searchUrl, { headers });
        if (res.ok) {
          results.company_profile = await res.json();
        } else {
          results.company_profile = {
            message: `Registry returned status ${res.status}. Manual verification may be required.`,
            searched_name: companyName,
            searched_number: registrationNumber,
          };
        }
      } catch (err) {
        results.company_profile = {
          message: `Unable to connect to registry: ${err.message}`,
          searched_name: companyName,
        };
      }
      break;
    }
  }

  return Object.keys(results).length > 0 ? results : null;
}

function analyzeMatch(resultType: string, registryData: any, borrowerData: any): any {
  if (!borrowerData || !registryData) return {};

  const analysis: any = { differences: [] };

  if (resultType === "company_profile") {
    // Compare company name
    const regName = registryData?.company_name || registryData?.title || "";
    const subName = borrowerData?.company_name || "";
    if (regName && subName && regName.toLowerCase() !== subName.toLowerCase()) {
      analysis.differences.push({
        field: "company_name",
        provided: subName,
        registry: regName,
        severity: "medium",
      });
    }

    // Compare address
    const regAddress = registryData?.registered_office_address || registryData?.address || {};
    const subAddress = borrowerData?.registered_address || {};
    if (typeof regAddress === "object" && typeof subAddress === "object") {
      const regLine = [regAddress.address_line_1, regAddress.locality, regAddress.postal_code].filter(Boolean).join(", ");
      const subLine = [subAddress.line1, subAddress.city, subAddress.postal_code].filter(Boolean).join(", ");
      if (regLine && subLine && regLine.toLowerCase() !== subLine.toLowerCase()) {
        analysis.differences.push({
          field: "registered_address",
          provided: subLine,
          registry: regLine,
          severity: "high",
          // Simplified distance - in production would use geocoding
          distance_km: "N/A",
        });
      }
    }

    analysis.overall_match = analysis.differences.length === 0 ? "match" : analysis.differences.some((d: any) => d.severity === "high") ? "mismatch" : "partial";
  }

  return analysis;
}
