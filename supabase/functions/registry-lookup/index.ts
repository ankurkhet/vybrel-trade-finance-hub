import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── AI Interpretation ─────────────────────────────────────────────────────────
async function interpretRegistryData(
  resultType: string,
  rawData: any,
  borrower: any,
  registryName: string,
): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const systemPrompt = `You are a KYB (Know Your Business) analyst at a trade finance originator. 
You will be given raw data from a company registry API and the borrower's submitted details.
Your job is to extract ONLY the meaningful, human-readable information and highlight any discrepancies or red flags.
Respond ONLY with valid JSON in the exact schema requested — no markdown, no prose outside JSON.`;

  const userPrompt = `Registry: ${registryName}
Check type: ${resultType}

Borrower submitted:
- Company name: ${borrower?.company_name || "N/A"}
- Registration number: ${borrower?.registration_number || "N/A"}
- Registered address: ${JSON.stringify(borrower?.registered_address || {})}
- Country: ${borrower?.country || "N/A"}
- Directors on record: ${JSON.stringify((borrower?.directors || []).map((d: any) => `${d.first_name} ${d.last_name}`).join(", ") || "N/A")}

Raw registry API response:
${JSON.stringify(rawData, null, 2).substring(0, 6000)}

Extract meaningful KYB findings. Return JSON only, no extra text.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "kyb_findings",
            description: "Extract structured KYB findings from raw registry data",
            parameters: {
              type: "object",
              properties: {
                verdict: {
                  type: "string",
                  enum: ["verified", "partial_match", "discrepancy_found", "not_found", "manual_review_required"],
                  description: "Overall KYB verification verdict for this check"
                },
                summary: {
                  type: "string",
                  description: "1-2 sentence plain-English summary of findings for this check"
                },
                key_facts: {
                  type: "array",
                  description: "Key facts extracted from the registry, as bullet points. Only include meaningful facts.",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      value: { type: "string" }
                    }
                  }
                },
                flags: {
                  type: "array",
                  description: "Discrepancies, risks, or red flags found. Empty array if none.",
                  items: {
                    type: "object",
                    properties: {
                      severity: { type: "string", enum: ["high", "medium", "low", "info"] },
                      message: { type: "string", description: "Plain-English description of the issue" },
                      field: { type: "string", description: "Which field or area the issue relates to" }
                    }
                  }
                },
                recommendation: {
                  type: "string",
                  description: "What action the analyst should take next, if any"
                },
                data_quality: {
                  type: "string",
                  enum: ["good", "partial", "poor", "no_data"],
                  description: "Quality of data returned by the registry"
                }
              },
              required: ["verdict", "summary", "key_facts", "flags", "data_quality"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "kyb_findings" } },
      }),
    });

    if (!response.ok) return null;
    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return null;
    return JSON.parse(toolCall.function.arguments);
  } catch (err) {
    console.error("AI interpretation error:", err);
    return null;
  }
}

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

      const isTrueLayer = (config.registry_name || "").toLowerCase().includes("truelayer");
      if (isTrueLayer) {
        let healthStatus = "unhealthy";
        let healthMessage = "Unknown";
        try {
          const tlRes = await fetch(`${supabaseUrl}/functions/v1/truelayer-name-verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({ action: "health_check" }),
          });
          const tlData = await tlRes.json();
          healthStatus = tlData.status || "unhealthy";
          healthMessage = tlData.message || "Unknown";
        } catch (err) {
          healthStatus = "unhealthy";
          healthMessage = `TrueLayer health check error: ${(err as Error).message}`;
        }

        await supabase
          .from("registry_api_configs")
          .update({ health_status: healthStatus, health_message: healthMessage, last_health_check: new Date().toISOString() })
          .eq("id", registry_id);

        return new Response(
          JSON.stringify({ status: healthStatus, message: healthMessage }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const noAuthNeeded = config.api_key_secret_name === "NO_AUTH_NEEDED" || (!config.api_key_value && !Deno.env.get(config.api_key_secret_name));
      const apiKey = noAuthNeeded ? null : (config.api_key_value || Deno.env.get(config.api_key_secret_name));
      let healthStatus = "unhealthy";
      let healthMessage = "API key not configured";

      const isCkan = config.registry_type === "ckan";
      if (apiKey || isCkan || noAuthNeeded) {
        try {
          const isFmp = isFmpRegistry(config.registry_name);
          const testUrl = isCkan
            ? getCkanHealthCheckUrl(config)
            : getHealthCheckUrl(config.country_code, config.api_base_url, config.registry_name, apiKey);
          const testHeaders: Record<string, string> = {};
          if (apiKey && !noAuthNeeded && !isFmp) {
            Object.assign(testHeaders, isCkan ? getCkanHeaders(apiKey) : getAuthHeaders(config.country_code, apiKey));
          }
          const res = await fetch(testUrl, { headers: testHeaders });
          const resBody = await res.text();

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
          healthMessage = `Connection error: ${(err as Error).message}`;
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

    const openBrisCountries = [
      "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
      "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
      "SI", "ES", "SE", "IS", "LI", "NO"
    ];

    const { data: registries } = await supabase
      .from("registry_api_configs")
      .select("*")
      .eq("country_code", country_code)
      .eq("is_active", true);

    let activeRegistries = registries || [];

    if (activeRegistries.length === 0 && openBrisCountries.includes(country_code)) {
      const { data: brisRegistries } = await supabase
        .from("registry_api_configs")
        .select("*")
        .eq("country_code", "EU")
        .eq("is_active", true);
      
      if (brisRegistries && brisRegistries.length > 0) {
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
        ai_summary: {
          verdict: "not_found",
          summary: `No active registry API is configured for ${country_code}. Manual verification required.`,
          key_facts: [],
          flags: [{ severity: "medium", message: `No registry configured for country ${country_code}`, field: "registry_config" }],
          data_quality: "no_data"
        }
      });

      return new Response(
        JSON.stringify({ message: `No active registry for country ${country_code}`, results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch borrower for AI context
    const { data: borrower } = await supabase
      .from("borrowers")
      .select("*, borrower_directors(*)")
      .eq("id", borrower_id)
      .single();

    const results: any[] = [];

    for (const registry of activeRegistries) {
      const noAuth = registry.api_key_secret_name === "NO_AUTH_NEEDED";
      const apiKey = noAuth ? null : (registry.api_key_value || Deno.env.get(registry.api_key_secret_name));
      const isCkan = registry.registry_type === "ckan";

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
          for (const [resultType, data] of Object.entries(companyData)) {
            const matchAnalysis = analyzeMatch(resultType, data, borrower);

            // AI Interpretation — extract human-readable findings from raw data
            const aiSummary = await interpretRegistryData(
              resultType,
              data,
              { ...borrower, directors: borrower?.borrower_directors || [] },
              registry.registry_name
            );

            await supabase.from("registry_results").insert({
              borrower_id,
              organization_id,
              registry_api_id: registry.id,
              result_type: resultType,
              data: data as any,
              match_analysis: matchAnalysis,
              ai_summary: aiSummary || null,
              fetched_at: new Date().toISOString(),
            });

            results.push({ registry: registry.registry_name, type: resultType, data, ai_summary: aiSummary });
          }
        }
      } catch (err) {
        results.push({ registry: registry.registry_name, error: (err as Error).message });

        await supabase
          .from("registry_api_configs")
          .update({
            health_status: "unhealthy",
            health_message: (err as Error).message,
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
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── CKAN helpers ───────────────────────────────────────────────────────────────

function getCkanBaseUrl(rawUrl: string): string {
  return rawUrl.replace(/\/+$/, "").replace(/\/api\/3\/action\/?$/, "");
}

function getCkanHealthCheckUrl(config: any): string {
  const base = getCkanBaseUrl(config.api_base_url);
  if (config.ckan_dataset_id) {
    return `${base}/api/3/action/package_show?id=${encodeURIComponent(config.ckan_dataset_id)}`;
  }
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
  const queryValue = registrationNumber || companyName;

  if (registry.ckan_resource_id) {
    const searchUrl = `${base}/api/3/action/datastore_search?resource_id=${encodeURIComponent(registry.ckan_resource_id)}&q=${encodeURIComponent(queryValue)}&limit=10`;
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

  const searchAction = registry.ckan_search_action || "package_search";
  const showAction = registry.ckan_show_action || "package_show";
  const queryParam = Object.values(fieldMapping)[0] as string || "q";

  if (searchAction === "package_search") {
    const searchUrl = `${base}/api/3/action/${searchAction}?${queryParam}=${encodeURIComponent(queryValue)}&rows=5`;
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
    const datasetId = registry.ckan_dataset_id;
    const showUrl = `${base}/api/3/action/${showAction}?id=${encodeURIComponent(datasetId)}`;
    const res = await fetch(showUrl, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`CKAN ${showAction} error ${res.status}: ${body.substring(0, 300)}`);
    }
    const data = await res.json();

    if (data.success && data.result?.resources?.length > 0) {
      const dsResource = data.result.resources.find((r: any) => r.datastore_active);
      if (dsResource) {
        const dsUrl = `${base}/api/3/action/datastore_search?resource_id=${dsResource.id}&q=${encodeURIComponent(queryValue)}&limit=10`;
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

// ─── REST helpers ───────────────────────────────────────────────────────────────

function getHealthCheckUrl(countryCode: string, baseUrl: string, registryName?: string, apiKey?: string | null): string {
  const name = (registryName || "").toLowerCase();
  if (name.includes("openiban")) return `${baseUrl.replace(/\/+$/, "")}/validate/DE89370400440532013000`;
  if (name.includes("sortcode")) return baseUrl.replace(/\/+$/, "");
  if (name.includes("financial modeling") || name.includes("fmp")) {
    const key = apiKey || "demo";
    const stableBase = baseUrl.replace(/\/+$/, "").replace(/\/api\/v[0-9]+$/, "");
    return `${stableBase}/stable/profile?symbol=AAPL&apikey=${encodeURIComponent(key)}`;
  }
  if (name.includes("creditsafe")) return `${baseUrl.replace(/\/+$/, "")}/authenticate`;
  if (name.includes("gleif")) return `${baseUrl.replace(/\/+$/, "")}/lei-records?page[size]=1`;

  switch (countryCode) {
    case "GB": return `${baseUrl}/search/companies?q=test&items_per_page=1`;
    case "DK": return `${baseUrl}?search=test&country=dk`;
    case "EU": return `${baseUrl}/api/search?q=test&country=de`;
    default: return baseUrl;
  }
}

function isFmpRegistry(registryName?: string): boolean {
  const name = (registryName || "").toLowerCase();
  return name.includes("financial modeling") || name.includes("fmp");
}

function getAuthHeaders(countryCode: string, apiKey: string): Record<string, string> {
  switch (countryCode) {
    case "GB": return { Authorization: `Basic ${btoa(apiKey + ":")}` };
    case "FR": return { Authorization: `Bearer ${apiKey}` };
    default: return { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey };
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
          message: `Unable to connect to registry: ${(err as Error).message}`,
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
