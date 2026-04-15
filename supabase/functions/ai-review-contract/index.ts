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
    const { contract_id, analysis_id } = body;

    // Platform health-check: called with empty body by RegistryApis health checker
    if (!contract_id) {
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

    const { data: contract } = await supabase
      .from("contracts")
      .select("*, documents(*), borrowers(company_name, industry, country)")
      .eq("id", contract_id)
      .single();

    if (!contract) {
      return new Response(JSON.stringify({ error: "Contract not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("ai_analyses").update({ status: "processing" }).eq("id", analysis_id);

    const systemPrompt = `You are a legal and financial contract analyst for a trade finance platform. Review the contract and provide:

1. **Key Terms**: Extract all critical contract terms (parties, amounts, dates, payment terms, governing law)
2. **Obligations**: List obligations for each party
3. **Risk Analysis**: Identify legal and financial risks
4. **Missing Clauses**: Flag standard clauses that are missing (force majeure, dispute resolution, termination, etc.)
5. **Red Flags**: Any concerning language or unusual terms
6. **Trade Finance Relevance**: How this contract supports invoice financing/factoring

Return structured analysis.`;

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
            content: `Review this contract:\nTitle: ${contract.title}\nCounterparty: ${contract.counterparty}\nValue: ${contract.contract_value} ${contract.currency}\nBorrower: ${contract.borrowers?.company_name}\nIndustry: ${contract.borrowers?.industry}\nTerms: ${JSON.stringify(contract.terms_summary)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "contract_review",
            description: "Return structured contract review results",
            parameters: {
              type: "object",
              properties: {
                key_terms: {
                  type: "object",
                  properties: {
                    parties: { type: "array", items: { type: "string" } },
                    contract_value: { type: "string" },
                    duration: { type: "string" },
                    payment_terms: { type: "string" },
                    governing_law: { type: "string" },
                  },
                },
                obligations: { type: "array", items: { type: "object", properties: { party: { type: "string" }, obligation: { type: "string" } }, required: ["party", "obligation"] } },
                risks: { type: "array", items: { type: "object", properties: { category: { type: "string" }, severity: { type: "string", enum: ["low", "medium", "high", "critical"] }, description: { type: "string" }, mitigation: { type: "string" } }, required: ["category", "severity", "description"] } },
                missing_clauses: { type: "array", items: { type: "string" } },
                red_flags: { type: "array", items: { type: "string" } },
                trade_finance_assessment: { type: "object", properties: { eligible_for_financing: { type: "boolean" }, reason: { type: "string" }, recommended_advance_rate: { type: "number" } } },
                overall_risk_rating: { type: "string", enum: ["low", "medium", "high", "critical"] },
                summary: { type: "string" },
              },
              required: ["key_terms", "risks", "overall_risk_rating", "summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "contract_review" } },
      }),
    });

    if (!response.ok) {
      await supabase.from("ai_analyses").update({ status: "failed" }).eq("id", analysis_id);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI review failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    const findings = toolCall ? JSON.parse(toolCall.function.arguments) : {};

    const riskMap: Record<string, number> = { low: 15, medium: 40, high: 70, critical: 95 };
    const riskScore = riskMap[findings.overall_risk_rating] || 50;

    // Update contract with extracted risk flags
    await supabase.from("contracts").update({
      risk_flags: findings.red_flags || [],
      terms_summary: findings.key_terms || {},
    }).eq("id", contract_id);

    await supabase.from("ai_analyses").update({
      status: "completed",
      findings,
      risk_score: riskScore,
      summary: findings.summary,
      annotations: findings.risks || [],
      completed_at: new Date().toISOString(),
    }).eq("id", analysis_id);

    return new Response(JSON.stringify({ success: true, findings, risk_score: riskScore }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
