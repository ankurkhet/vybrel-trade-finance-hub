import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Return a JSON object with:
- "document_classification": string
- "extracted_fields": object with key-value pairs
- "completeness_score": number 0-100
- "missing_fields": string array
- "risk_flags": array of { "severity": "low"|"medium"|"high", "description": string }
- "compliance_notes": string array
- "summary": string (2-3 sentence overview)
- "annotations": array of { "field": string, "value": string, "confidence": number, "note": string }`;

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
            content: `Analyze this document:\nFile: ${doc.file_name}\nType: ${doc.document_type}\nMetadata: ${JSON.stringify(doc.metadata)}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "document_analysis",
            description: "Return structured document analysis results",
            parameters: {
              type: "object",
              properties: {
                document_classification: { type: "string" },
                extracted_fields: { type: "object" },
                completeness_score: { type: "number" },
                missing_fields: { type: "array", items: { type: "string" } },
                risk_flags: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                      description: { type: "string" },
                    },
                    required: ["severity", "description"],
                  },
                },
                compliance_notes: { type: "array", items: { type: "string" } },
                summary: { type: "string" },
                annotations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      field: { type: "string" },
                      value: { type: "string" },
                      confidence: { type: "number" },
                      note: { type: "string" },
                    },
                    required: ["field", "value", "confidence"],
                  },
                },
              },
              required: ["document_classification", "extracted_fields", "completeness_score", "summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "document_analysis" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      await supabase.from("ai_analyses").update({ status: "failed" }).eq("id", analysis_id);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI analysis failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    const findings = toolCall ? JSON.parse(toolCall.function.arguments) : {};

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
