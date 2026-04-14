import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { file_name, file_type, file_size, expected_doc_type, expected_doc_label } = await req.json();

    const systemPrompt = `You are a document classification expert for a trade finance KYC/KYB platform.
Given a file's name, MIME type, and size, determine if it likely matches the expected document type.

Expected document types and what they should contain:
- certificate_of_incorporation: Company incorporation/registration certificate
- tax_registration: Tax ID, VAT, or GST registration documents
- board_resolution: Board resolution or corporate authorization
- kyc_directors: ID documents for directors/shareholders (passports, IDs)
- aml_policy: AML/CFT compliance policy documents
- financial_statements: Audited financial statements, balance sheets
- business_license: Business or trade license
- individual_passport: Personal passport document
- individual_driving_license: Driving license document
- individual_bank_statement: Bank account statement
- individual_utility_statement: Utility bill (electricity, water, gas)
- memorandum_of_association: Company MoA/AoA
- shareholder_agreement: Shareholder agreement document
- power_of_attorney: Power of attorney document
- proof_of_address: Company proof of address
- regulatory_license: Regulatory or financial license
- insurance_certificate: Insurance policy/certificate
- other: Any other document

Analyze the file name for clues about its content. Consider common naming patterns.`;

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
            content: `File name: "${file_name}"\nMIME type: ${file_type}\nFile size: ${file_size} bytes\nExpected document type: "${expected_doc_type}" (${expected_doc_label})\n\nDoes this file likely match the expected document type?`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "validate_document_type",
            description: "Validate if the file matches the expected document type",
            parameters: {
              type: "object",
              properties: {
                matches: { type: "boolean", description: "Whether the file likely matches the expected document type" },
                confidence: { type: "number", description: "Confidence score 0-100" },
                suggested_type: { type: "string", description: "If not matching, suggest the correct document type key" },
                suggested_label: { type: "string", description: "Human readable label for the suggested type" },
                reason: { type: "string", description: "Brief explanation of the assessment" },
              },
              required: ["matches", "confidence", "reason"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "validate_document_type" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI validation failed");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    const result = toolCall ? JSON.parse(toolCall.function.arguments) : { matches: true, confidence: 50, reason: "Could not determine" };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
