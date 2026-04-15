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

    const { document_id, analysis_id } = await req.json();

    // Fetch document metadata
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update analysis status
    await supabase.from("ai_analyses").update({ status: "processing" }).eq("id", analysis_id);

    const systemPrompt = `You are a financial document analyst for a trade finance platform. Analyze the uploaded document and extract:

1. **Document Type Classification**: Identify if it's a KYC document, financial statement, incorporation certificate, or other
2. **Key Fields Extraction**: Extract all relevant fields (names, dates, amounts, registration numbers, addresses)
3. **Completeness Check**: Flag any missing required fields
4. **Authenticity Indicators**: Note any formatting issues or inconsistencies
5. **Risk Flags**: Identify any potential red flags (expired documents, mismatched information)
6. **Compliance Notes**: Check against standard KYC/AML requirements

Return a valid JSON object (no markdown fences) with these exact keys:
{
  "document_classification": "string",
  "extracted_fields": {},
  "completeness_score": 0,
  "missing_fields": [],
  "risk_flags": [{"severity": "low|medium|high", "description": "string"}],
  "compliance_notes": [],
  "summary": "string",
  "annotations": [{"field": "string", "value": "string", "confidence": 0, "note": "string"}]
}`;

    let findings: any = {};
    try {
      const rawText = await ai.complete(
        systemPrompt,
        `Analyze this document:\nFile: ${doc.file_name}\nType: ${doc.document_type}\nMetadata: ${JSON.stringify(doc.metadata)}`,
        { maxTokens: 2048, temperature: 0.2 }
      );
      const jsonStr = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
      findings = JSON.parse(jsonStr);
    } catch (aiErr: any) {
      await supabase.from("ai_analyses").update({ status: "failed" }).eq("id", analysis_id);
      return new Response(JSON.stringify({ error: aiErr.message || "AI analysis failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const riskScore = findings.risk_flags?.length
      ? Math.min(100, findings.risk_flags.filter((f: any) => f.severity === "high").length * 30 +
          findings.risk_flags.filter((f: any) => f.severity === "medium").length * 15 +
          findings.risk_flags.filter((f: any) => f.severity === "low").length * 5)
      : 0;

    await supabase.from("ai_analyses").update({
      status: "completed",
      findings,
      risk_score: riskScore,
      summary: findings.summary,
      annotations: findings.annotations || [],
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
