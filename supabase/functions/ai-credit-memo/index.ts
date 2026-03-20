import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    const { borrower_id, transaction_type, credit_memo_id, analysis_id } = await req.json();

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

    const systemPrompt = `You are a senior credit analyst at a trade finance platform. Generate a comprehensive credit memo draft.

DATA PRIORITY RULES (STRICTLY FOLLOW):
1. For ALL financial numbers (turnover, profit, balance sheet, ratios): ALWAYS prefer filing/registry data first.
2. If filing and API data conflict, USE FILING INFORMATION.
3. If financial data is missing from both filings and APIs, use internet sources ONLY IF reliable and CLEARLY label: "Estimated from public sources – source: [name], dated [DD/MM/YYYY]".
4. Non-financial overview (company background, market position, recent news, risks) always comes from internet research and general knowledge.

SECTIONS REQUIRED:
1. **Company Overview** – Background, industry, market position, recent news
2. **Financial Summary** – Key financials with clear source labels (Filing / API / Estimated)
3. **Risk Assessment** – Credit risks, industry risks, country risks, concentration risks
4. **Recommendation** – Approve/Decline/Conditional with justification
5. **Sources** – List all data sources used with dates

Format in professional markdown. Be specific about numbers and cite sources.`;

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
          {
            role: "user",
            content: `Generate a credit memo for:\n\n${JSON.stringify(context, null, 2)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "credit_memo",
            description: "Return structured credit memo with sections",
            parameters: {
              type: "object",
              properties: {
                memo_text: { type: "string", description: "Full credit memo in professional markdown with Company Overview, Financial Summary, Risk Assessment, Recommendation, and Sources sections" },
                risk_rating: { type: "string", enum: ["low", "moderate", "elevated", "high", "critical"] },
                recommended_limit: { type: "number" },
                recommended_advance_rate: { type: "number", description: "Percentage 0-100" },
                key_risks: { type: "array", items: { type: "string" } },
                key_strengths: { type: "array", items: { type: "string" } },
                conditions_precedent: { type: "array", items: { type: "string" } },
                recommendation: { type: "string", enum: ["approve", "approve_with_conditions", "decline", "defer"] },
                summary: { type: "string", description: "2-3 sentence executive summary" },
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
