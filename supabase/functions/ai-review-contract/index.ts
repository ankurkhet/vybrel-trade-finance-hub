import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAIClient } from "../_shared/ai-client.ts";

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
    const ai = await createAIClient(_admin);

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

    const userPrompt = `Review this contract:
Title: ${contract.title}
Counterparty: ${contract.counterparty}
Value: ${contract.contract_value} ${contract.currency}
Borrower: ${contract.borrowers?.company_name}
Industry: ${contract.borrowers?.industry}
Terms: ${JSON.stringify(contract.terms_summary)}

Return a valid JSON object (no markdown fences) with:
{
  "key_terms": {"parties": [], "contract_value": "", "duration": "", "payment_terms": "", "governing_law": ""},
  "obligations": [{"party": "", "obligation": ""}],
  "risks": [{"category": "", "severity": "low|medium|high|critical", "description": "", "mitigation": ""}],
  "missing_clauses": [],
  "red_flags": [],
  "trade_finance_assessment": {"eligible_for_financing": true, "reason": "", "recommended_advance_rate": 0},
  "overall_risk_rating": "low|medium|high|critical",
  "summary": "string"
}`;

    let findings: any = {};
    try {
      const rawText = await ai.complete(
        `You are a legal and financial contract analyst for a trade finance platform.`,
        userPrompt,
        { maxTokens: 2048, temperature: 0.2 }
      );
      const jsonStr = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
      findings = JSON.parse(jsonStr);
    } catch (aiErr: any) {
      await supabase.from("ai_analyses").update({ status: "failed" }).eq("id", analysis_id);
      return new Response(JSON.stringify({ error: aiErr.message || "AI review failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
