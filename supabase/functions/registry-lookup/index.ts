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

      const noAuthNeeded = config.api_key_secret_name === "NO_AUTH_NEEDED" || (!config.api_key_value && !Deno.env.get(config.api_key_secret_name));
      const apiKey = noAuthNeeded ? null : (config.api_key_value || Deno.env.get(config.api_key_secret_name));
      let healthStatus = "unhealthy";
      let healthMessage = "API key not configured";

      const isCkan = config.registry_type === "ckan";
      // Allow health check if we have an API key, it's CKAN, or no auth is needed
      if (apiKey || isCkan || noAuthNeeded) {
        try {
          const testUrl = isCkan
            ? getCkanHealthCheckUrl(config)
            : getHealthCheckUrl(config.country_code, config.api_base_url, config.registry_name);
          const testHeaders: Record<string, string> = {};
          if (apiKey && !noAuthNeeded) {
            Object.assign(testHeaders, isCkan ? getCkanHeaders(apiKey) : getAuthHeaders(config.country_code, apiKey));
          }
          console.log(`Health check URL: ${testUrl}, noAuth: ${noAuthNeeded}`);
          const res = await fetch(testUrl, { headers: testHeaders });
          const resBody = await res.text();
          console.log(`Health check response: status=${res.status}, body=${resBody.substring(0, 500)}`);

          if (isCkan) {
            try {
              const parsed = JSON.parse(resBody);
              if (parsed.success === true || res.ok) {
                healthStatus = "healthy";
                healthMessage = "CKAN portal responding normally";
              } else {
                healthStatus = "unhealthy";
                healthMessage = `CKAN returned success=false: ${parsed.error?.message || res.status}`;
              }
            } catch {
              healthStatus = res.ok ? "healthy" : "unhealthy";
              healthMessage = res.ok ? "Portal responding" : `Portal returned status ${res.status}`;
            }
          } else {
            if (res.ok || res.status === 200) {
              healthStatus = "healthy";
              healthMessage = noAuthNeeded ? "API responding (no auth required)" : "API responding normally";
            } else if (res.status === 401 || res.status === 403) {
              healthStatus = "unhealthy";
              healthMessage = `Authentication failed (${res.status}). Please verify the API key.`;
            } else {
              healthStatus = "unhealthy";
              healthMessage = `API returned status ${res.status}`;
            }
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
      const noAuth = registry.api_key_secret_name === "NO_AUTH_NEEDED";
      const apiKey = noAuth ? null : (registry.api_key_value || Deno.env.get(registry.api_key_secret_name));
      const isCkan = registry.registry_type === "ckan";

      // CKAN portals and no-auth APIs don't need keys
      if (!apiKey && !isCkan && !noAuth) {
        results.push({
          registry: registry.registry_name,
          error: `API key ${registry.api_key_secret_name} not configured`,
        });
        continue;
      }

      try {
        const companyData = isCkan
          ? await fetchCkanCompanyData(registry, apiKey, company_name, registration_number)
          : await fetchCompanyData(registry, apiKey!, company_name, registration_number, country_code);

        if (companyData) {
          const { data: borrower } = await supabase
            .from("borrowers")
            .select("*")
            .eq("id", borrower_id)
            .single();

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

// ─── CKAN helpers ───────────────────────────────────────────────────

function getCkanBaseUrl(rawUrl: string): string {
  // Strip trailing slash and /api/3/action suffix if already included
  return rawUrl.replace(/\/+$/, "").replace(/\/api\/3\/action\/?$/, "");
}

function getCkanHealthCheckUrl(config: any): string {
  const base = getCkanBaseUrl(config.api_base_url);
  // Use package_show with the configured dataset to verify connectivity
  if (config.ckan_dataset_id) {
    return `${base}/api/3/action/package_show?id=${encodeURIComponent(config.ckan_dataset_id)}`;
  }
  // Fallback: site_read action (always available on CKAN)
  return `${base}/api/3/action/site_read`;
}

function getCkanHeaders(apiKey?: string): Record<string, string> {
  if (!apiKey) return {};
  return { Authorization: apiKey };
}

async function fetchCkanCompanyData(
  registry: any,
  apiKey: string | null,
  companyName: string,
  registrationNumber?: string,
): Promise<Record<string, any> | null> {
  const base = getCkanBaseUrl(registry.api_base_url);
  const headers = apiKey ? getCkanHeaders(apiKey) : {};
  const results: Record<string, any> = {};
  const fieldMapping = registry.ckan_query_field_mapping || {};

  // Determine the search query value
  const queryValue = registrationNumber || companyName;

  // If resource_id is set → use datastore_search
  if (registry.ckan_resource_id) {
    const searchUrl = `${base}/api/3/action/datastore_search?resource_id=${encodeURIComponent(registry.ckan_resource_id)}&q=${encodeURIComponent(queryValue)}&limit=10`;
    console.log(`CKAN datastore_search: ${searchUrl}`);
    const res = await fetch(searchUrl, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`CKAN datastore_search error ${res.status}: ${body.substring(0, 300)}`);
    }
    const data = await res.json();
    if (data.success && data.result?.records) {
      results.company_profile = normalizeCkanRecords(data.result.records, registry);
    } else {
      results.company_profile = { raw: data, message: "No records found" };
    }
    return Object.keys(results).length > 0 ? results : null;
  }

  // Otherwise use package_search / package_show flow
  const searchAction = registry.ckan_search_action || "package_search";
  const showAction = registry.ckan_show_action || "package_show";

  // Determine which query parameter to use from mapping
  const queryParam = Object.values(fieldMapping)[0] as string || "q";

  if (searchAction === "package_search") {
    // Search for datasets matching the query
    const searchUrl = `${base}/api/3/action/${searchAction}?${queryParam}=${encodeURIComponent(queryValue)}&rows=5`;
    console.log(`CKAN package_search: ${searchUrl}`);
    const res = await fetch(searchUrl, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`CKAN ${searchAction} error ${res.status}: ${body.substring(0, 300)}`);
    }
    const data = await res.json();
    if (data.success && data.result?.results?.length > 0) {
      results.company_profile = {
        source: "ckan_package_search",
        count: data.result.count,
        results: data.result.results.map((r: any) => ({
          name: r.name,
          title: r.title,
          notes: r.notes,
          organization: r.organization?.title,
          metadata_modified: r.metadata_modified,
          resources: r.resources?.length || 0,
        })),
      };
    } else {
      results.company_profile = { message: "No matching datasets found", searched: queryValue };
    }
  } else {
    // Use configured show action with the dataset
    const datasetId = registry.ckan_dataset_id;
    const showUrl = `${base}/api/3/action/${showAction}?id=${encodeURIComponent(datasetId)}`;
    console.log(`CKAN ${showAction}: ${showUrl}`);
    const res = await fetch(showUrl, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`CKAN ${showAction} error ${res.status}: ${body.substring(0, 300)}`);
    }
    const data = await res.json();

    // If dataset has datastore-enabled resources, search within them
    if (data.success && data.result?.resources?.length > 0) {
      const dsResource = data.result.resources.find((r: any) => r.datastore_active);
      if (dsResource) {
        const dsUrl = `${base}/api/3/action/datastore_search?resource_id=${dsResource.id}&q=${encodeURIComponent(queryValue)}&limit=10`;
        console.log(`CKAN auto-datastore: ${dsUrl}`);
        const dsRes = await fetch(dsUrl, { headers });
        if (dsRes.ok) {
          const dsData = await dsRes.json();
          if (dsData.success && dsData.result?.records) {
            results.company_profile = normalizeCkanRecords(dsData.result.records, registry);
            return Object.keys(results).length > 0 ? results : null;
          }
        }
      }
    }

    results.company_profile = data.success ? data.result : { message: "Dataset not found" };
  }

  return Object.keys(results).length > 0 ? results : null;
}

function normalizeCkanRecords(records: any[], _registry: any): any {
  // Try to map common CKAN company data fields to structured output
  return {
    source: "ckan_datastore",
    count: records.length,
    companies: records.map((r: any) => ({
      company_name: r.Company_Name || r.company_name || r.name || r.organisation_name || r.Name || null,
      status: r.Company_Status || r.status || r.Status || null,
      type: r.Company_Type || r.type || r.Type || r.Company_Class || null,
      registration_number: r.ACN || r.ABN || r.Company_Number || r.registration_number || r.CRN || null,
      registration_date: r.Registration_Date || r.date_registered || r.Date_Registered || null,
      state: r.State || r.state || r.Jurisdiction || null,
      postcode: r.Postcode || r.postcode || r.Post_Code || null,
      raw: r,
    })),
  };
}

// ─── REST helpers (existing) ────────────────────────────────────────

function getHealthCheckUrl(countryCode: string, baseUrl: string, registryName?: string): string {
  // Handle specific registries by name first
  const name = (registryName || "").toLowerCase();
  if (name.includes("openiban")) {
    return `${baseUrl.replace(/\/+$/, "")}/validate/DE89370400440532013000`;
  }
  if (name.includes("sortcode")) {
    // Just verify the site is reachable
    return baseUrl.replace(/\/+$/, "");
  }
  if (name.includes("financial modeling") || name.includes("fmp")) {
    // FMP requires apikey param even for health check
    return `${baseUrl.replace(/\/+$/, "")}/stock/list?apikey=demo`;
  }
  if (name.includes("creditsafe")) {
    return `${baseUrl.replace(/\/+$/, "")}/authenticate`;
  }

  switch (countryCode) {
    case "GB":
      return `${baseUrl}/search/companies?q=test&items_per_page=1`;
    case "DK":
      return `${baseUrl}?search=test&country=dk`;
    case "EU":
      return `${baseUrl}/api/search?q=test&country=de`;
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
  const effectiveCountry = registry.country_code === "EU" ? (lookupCountryCode || "EU") : registry.country_code;
  const headers = getAuthHeaders(effectiveCountry, apiKey);

  switch (registry.country_code) {
    case "GB": {
      const searchUrl = registrationNumber
        ? `${registry.api_base_url}/company/${registrationNumber}`
        : `${registry.api_base_url}/search/companies?q=${encodeURIComponent(companyName)}&items_per_page=5`;

      const searchRes = await fetch(searchUrl, { headers });
      if (!searchRes.ok) throw new Error(`Companies House API error: ${searchRes.status}`);
      const searchData = await searchRes.json();
      results.company_profile = searchData;

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
      const searchUrl = `${registry.api_base_url}?search=${encodeURIComponent(registrationNumber || companyName)}&country=dk`;
      const res = await fetch(searchUrl, { headers });
      if (!res.ok) throw new Error(`CVR API error: ${res.status}`);
      results.company_profile = await res.json();
      break;
    }

    case "EU": {
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
          distance_km: "N/A",
        });
      }
    }

    analysis.overall_match = analysis.differences.length === 0 ? "match" : analysis.differences.some((d: any) => d.severity === "high") ? "mismatch" : "partial";
  }

  return analysis;
}
