import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { borrower_id, transaction_type, credit_memo_id, analysis_id } = body;

    // Platform health-check: called with empty body by RegistryApis health checker
    if (!borrower_id) {
      return new Response(
        JSON.stringify({ healthy: true, mode: "health_check" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const _admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const OPENAI_API_KEY = await (async () => {
      const _k = Deno.env.get("OPENAI_API_KEY");
      if (_k) return _k;
      const { data: _s } = await _admin.from("platform_secrets").select("value").eq("key", "OPENAI_API_KEY").single();
      if (!_s?.value) throw new Error("OPENAI_API_KEY not configured. Set it in Admin → Registry APIs → Secrets.");
      return _s.value as string;
    })();

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch borrower
    const { data: borrower } = await supabase
      .from("borrowers")
      .select("*")
      .eq("id", borrower_id)
      .single();

    if (!borrower) {
      return new Response(JSON.stringify({ error: "Borrower not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch related data in parallel
    const [contractsRes, invoicesRes, documentsRes, analysesRes, directorsRes] = await Promise.all([
      supabase.from("contracts").select("*").eq("borrower_id", borrower_id),
      supabase.from("invoices").select("*").eq("borrower_id", borrower_id),
      supabase.from("documents").select("*").eq("borrower_id", borrower_id),
      supabase.from("ai_analyses").select("*").eq("borrower_id", borrower_id).eq("status", "completed"),
      supabase.from("borrower_directors").select("*").eq("borrower_id", borrower_id),
    ]);

    // Fetch active financial API configs for enrichment context
    const { data: financialApis } = await supabase
      .from("registry_api_configs")
      .select("*")
      .eq("is_active", true)
      .contains("capabilities", ["financial_data"]);

    // Fetch active registry configs for filing data context
    const { data: registryApis } = await supabase
      .from("registry_api_configs")
      .select("*")
      .eq("is_active", true)
      .contains("capabilities", ["company_profile"]);

    await supabase.from("ai_analyses").update({ status: "processing" }).eq("id", analysis_id);

    const systemPrompt = `You are a senior credit analyst at a trade finance originator. Generate a comprehensive credit memo matching the exact structure used in professional trade finance credit memos.

DATA PRIORITY RULES (STRICTLY FOLLOW):
1. ALWAYS prioritise information supplied by the borrower/customer FIRST.
2. Then use Companies House / registry filing data to verify and supplement.
3. If filing and API data conflict, USE the borrower-supplied information but FLAG the discrepancy.
4. Use internet sources ONLY for non-financial context (market position, news, Google searches on company/directors) and CLEARLY label: "Source: [name], [date]".
5. Financial numbers MUST come from filings or borrower-supplied statements – never estimated.

CREDIT MEMO FORMAT (follow this exact structure):

# Credit Memo

## Borrower Company Name & Registered Address
## Trading Address (if different)
## Nature of Business (SIC)

## Facility Sought
Table with: Type | Amount | Tenor | Pricing columns

## Purpose
Why the borrower needs the facility

## Countries
Procurement and customer countries

## Initial Debtor/Counterparty Limits
Table with: Customer Name | Registered Number | Proposed Limits

## Company Details
- Company Registered Number & Year of Incorporation
- Related/Associated Companies (with registration numbers, net asset positions)

## Ultimate Business Owner (UBO)
Name, Position, Contact details, Home address and value, Website

## Shareholders
Table with: Shareholder | % columns

## Google Searches on Company
Summary of public information found, any adverse info

## Brief Description of Main Activity
Sectors served, services supplied, certifications

## Payables / Debts to be Financed (if Payables facility)
Supplier details, goods, countries, aged purchase ledger summary

## Invoice Discounting / Debts to be Financed (if Receivables facility)
Typical ledger value, live balances, aged debt, what invoices are for, overseas debtors

## Credit Insurance Policy (if applicable)
Policy details, insurer, loss payee status

## Financial Details
Bank accounts, existing borrowings (who with, how much, secured/unsecured)
Waiver over debenture status

## Financial Analysis
Multi-year table with: Revenues, Gross Profit, EBITDA, Interest, Depreciation, Net Profit, Short/Long Term Debt, Debtors, Creditors, Tangible Net Worth, Receivable Days, Payable Days, Revenue Growth %, Gross Profit %

## Financial Performance Metrics
EBITDA %, Net Profit %, Interest Coverage Ratio, Debt/TNW
Commentary on losses, exceptional items, scale-up costs

## Revenue Pipeline
Contracted revenue, pipeline, projections

## Profitability Analysis
Gross profit, EBITDA, Net Profit trends and commentary

## Balance Sheet Analysis
TNW, debt levels, leverage ratios

## Working Capital
Receivable/Payable days trends

## Industry Benchmark Comparison
Company vs industry ratios

## Risk Assessment
Credit risks, concentration risks, country risks, industry risks
Mitigants for each risk identified

## Recommendation
Approve / Approve with Conditions / Decline / Defer
Proposed limits, conditions precedent, covenants

## Sources
List all data sources used with dates

Be specific about numbers. Use tables extensively. Cite sources for all financial data.`;

    const context = {
      borrower: {
        company_name: borrower.company_name,
        trading_name: borrower.trading_name,
        industry: borrower.industry,
        country: borrower.country,
        registration_number: borrower.registration_number,
        incorporation_date: borrower.incorporation_date,
        annual_turnover: borrower.annual_turnover,
        num_employees: borrower.num_employees,
        kyc_completed: borrower.kyc_completed,
        aml_cleared: borrower.aml_cleared,
        current_limit: borrower.credit_limit,
        website: borrower.website,
        vat_tax_id: borrower.vat_tax_id,
        registered_address: borrower.registered_address,
      },
      directors: (directorsRes.data || []).map((d: any) => ({
        name: `${d.first_name} ${d.last_name}`,
        role: d.role,
        nationality: d.nationality,
        shareholding_pct: d.shareholding_pct,
      })),
      transaction_type,
      contracts_count: contractsRes.data?.length || 0,
      contracts_summary: (contractsRes.data || []).map((c: any) => ({
        title: c.title, counterparty: c.counterparty, value: c.contract_value, currency: c.currency, status: c.status,
      })),
      invoices_count: invoicesRes.data?.length || 0,
      total_invoice_value: (invoicesRes.data || []).reduce((sum: number, i: any) => sum + Number(i.amount), 0),
      documents_count: documentsRes.data?.length || 0,
      prior_analyses: (analysesRes.data || []).map((a: any) => ({
        type: a.analysis_type, risk_score: a.risk_score, summary: a.summary,
      })),
      connected_financial_apis: (financialApis || []).map((a: any) => a.registry_name),
      connected_registries: (registryApis || []).map((a: any) => ({
        name: a.registry_name, country: a.country_code,
      })),
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a credit memo for:\n\n${JSON.stringify(context, null, 2)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "credit_memo",
            description: "Return structured credit memo matching the Convenient Capital format",
            parameters: {
              type: "object",
              properties: {
                memo_text: { type: "string", description: "Full credit memo in professional markdown following the exact structure: Company Details, Facility Sought, Purpose, Countries, Debtor Limits, UBO, Shareholders, Financial Analysis (multi-year tables), Performance Metrics, Revenue Pipeline, Risk Assessment, Recommendation, Sources" },
                risk_rating: { type: "string", enum: ["low", "moderate", "elevated", "high", "critical"] },
                recommended_limit: { type: "number" },
                recommended_advance_rate: { type: "number", description: "Percentage 0-100" },
                key_risks: { type: "array", items: { type: "string" } },
                key_strengths: { type: "array", items: { type: "string" } },
                conditions_precedent: { type: "array", items: { type: "string" } },
                recommendation: { type: "string", enum: ["approve", "approve_with_conditions", "decline", "defer"] },
                summary: { type: "string", description: "2-3 sentence executive summary" },
                facility_sought: { type: "array", items: { type: "object", properties: { type: { type: "string" }, amount: { type: "number" }, tenor: { type: "string" }, pricing: { type: "string" } } } },
                financial_analysis: { type: "object", description: "Multi-year financial data extracted or computed" },
              },
              required: ["memo_text", "risk_rating", "recommendation", "summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "credit_memo" } },
      }),
    });

    if (!response.ok) {
      await supabase.from("ai_analyses").update({ status: "failed" }).eq("id", analysis_id);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI credit memo generation failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    const findings = toolCall ? JSON.parse(toolCall.function.arguments) : {};

    const riskMap: Record<string, number> = { low: 10, moderate: 30, elevated: 50, high: 75, critical: 95 };

    // Update credit memo
    await supabase.from("credit_memos").update({
      status: "ai_generated",
      ai_draft: findings.memo_text,
      risk_rating: findings.risk_rating,
      recommended_limit: findings.recommended_limit,
      transaction_type,
      borrower_profile: context.borrower,
    }).eq("id", credit_memo_id);

    await supabase.from("ai_analyses").update({
      status: "completed",
      findings,
      risk_score: riskMap[findings.risk_rating] || 50,
      summary: findings.summary,
      completed_at: new Date().toISOString(),
    }).eq("id", analysis_id);

    return new Response(JSON.stringify({ success: true, findings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
