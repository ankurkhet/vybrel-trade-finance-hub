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

    const { invoice_id, analysis_id } = await req.json();

    // Fetch invoice with related contract
    const { data: invoice } = await supabase
      .from("invoices")
      .select("*, contracts(*)")
      .eq("id", invoice_id)
      .single();

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all contracts for this borrower to find best match
    const { data: contracts } = await supabase
      .from("contracts")
      .select("*")
      .eq("borrower_id", invoice.borrower_id)
      .eq("status", "active");

    await supabase.from("ai_analyses").update({ status: "processing" }).eq("id", analysis_id);

    const systemPrompt = `You are a trade finance analyst matching invoices against contracts. Analyze:

1. **Counterparty Match**: Does the invoice debtor match a contract counterparty?
2. **Amount Validation**: Is the invoice amount within contract limits?
3. **Date Validation**: Is the invoice within the contract period?
4. **Terms Compliance**: Does the invoice align with contract payment terms?
5. **Duplicate Check**: Any signs this could be a duplicate or fraudulent invoice?
6. **Concentration Risk**: Is there over-reliance on a single debtor?

Return match results with confidence scores.`;

    const userPrompt = `Match this invoice against contracts:

Invoice:
- Number: ${invoice.invoice_number}
- Debtor: ${invoice.debtor_name}
- Amount: ${invoice.amount} ${invoice.currency}
- Issue Date: ${invoice.issue_date}
- Due Date: ${invoice.due_date}

Available Contracts:
${(contracts || []).map((c: any) => `- ${c.title} | Counterparty: ${c.counterparty} | Value: ${c.contract_value} ${c.currency} | Period: ${c.start_date} to ${c.end_date}`).join("\n")}

Return a valid JSON object (no markdown fences) with:
{
  "best_match_contract": "title or none",
  "match_score": 0,
  "counterparty_match": true,
  "amount_within_limits": true,
  "date_within_period": true,
  "terms_compliant": true,
  "discrepancies": [],
  "fraud_indicators": [],
  "recommendation": "approve|review|reject",
  "summary": "string"
}`;

    let findings: any = {};
    try {
      const rawText = await ai.complete(
        `You are a trade finance analyst matching invoices against contracts. Analyze counterparty match, amount validation, date validation, terms compliance, duplicates, and concentration risk.`,
        userPrompt,
        { maxTokens: 1024, temperature: 0.2 }
      );
      const jsonStr = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
      findings = JSON.parse(jsonStr);
    } catch (aiErr: any) {
      await supabase.from("ai_analyses").update({ status: "failed" }).eq("id", analysis_id);
      return new Response(JSON.stringify({ error: aiErr.message || "AI matching failed" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update invoice with match results
    await supabase.from("invoices").update({
      match_score: findings.match_score,
      match_details: findings,
    }).eq("id", invoice_id);

    await supabase.from("ai_analyses").update({
      status: "completed",
      findings,
      risk_score: 100 - (findings.match_score || 0),
      summary: findings.summary,
      annotations: findings.discrepancies || [],
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
