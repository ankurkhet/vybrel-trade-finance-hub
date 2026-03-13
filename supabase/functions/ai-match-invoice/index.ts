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
            content: `Match this invoice against contracts:\n\nInvoice:\n- Number: ${invoice.invoice_number}\n- Debtor: ${invoice.debtor_name}\n- Amount: ${invoice.amount} ${invoice.currency}\n- Issue Date: ${invoice.issue_date}\n- Due Date: ${invoice.due_date}\n\nAvailable Contracts:\n${(contracts || []).map((c: any) => `- ${c.title} | Counterparty: ${c.counterparty} | Value: ${c.contract_value} ${c.currency} | Period: ${c.start_date} to ${c.end_date}`).join("\n")}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "invoice_match",
            description: "Return invoice-contract matching results",
            parameters: {
              type: "object",
              properties: {
                best_match_contract: { type: "string", description: "Title of best matching contract or 'none'" },
                match_score: { type: "number", description: "0-100 confidence score" },
                counterparty_match: { type: "boolean" },
                amount_within_limits: { type: "boolean" },
                date_within_period: { type: "boolean" },
                terms_compliant: { type: "boolean" },
                discrepancies: { type: "array", items: { type: "object", properties: { field: { type: "string" }, invoice_value: { type: "string" }, contract_value: { type: "string" }, severity: { type: "string", enum: ["info", "warning", "critical"] } }, required: ["field", "severity"] } },
                fraud_indicators: { type: "array", items: { type: "string" } },
                recommendation: { type: "string", enum: ["approve", "review", "reject"] },
                summary: { type: "string" },
              },
              required: ["match_score", "recommendation", "summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "invoice_match" } },
      }),
    });

    if (!response.ok) {
      await supabase.from("ai_analyses").update({ status: "failed" }).eq("id", analysis_id);
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI matching failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    const findings = toolCall ? JSON.parse(toolCall.function.arguments) : {};

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
