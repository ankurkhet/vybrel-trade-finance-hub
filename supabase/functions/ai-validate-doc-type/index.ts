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

    const { file_name, file_type, file_size, expected_doc_type, expected_doc_label } = await req.json();

    const systemPrompt = `You are a document classification expert for a trade finance KYC/KYB platform.
Given a file's name, MIME type, and size, determine if it likely matches the expected document type.

Expected document types and what they should contain:
- certificate_of_incorporation, tax_registration, board_resolution, kyc_directors, aml_policy,
  financial_statements, business_license, individual_passport, individual_driving_license,
  individual_bank_statement, individual_utility_statement, memorandum_of_association,
  shareholder_agreement, power_of_attorney, proof_of_address, regulatory_license,
  insurance_certificate, other

Return a valid JSON object (no markdown fences) with:
{
  "matches": true,
  "confidence": 80,
  "suggested_type": "type_key_if_not_matching",
  "suggested_label": "Human label",
  "reason": "brief explanation"
}`;

    let result: any = { matches: true, confidence: 50, reason: "Could not determine" };
    try {
      const rawText = await ai.complete(
        systemPrompt,
        `File name: "${file_name}"\nMIME type: ${file_type}\nFile size: ${file_size} bytes\nExpected document type: "${expected_doc_type}" (${expected_doc_label})\n\nDoes this file likely match the expected document type?`,
        { maxTokens: 512, temperature: 0.1 }
      );
      const jsonStr = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
      result = JSON.parse(jsonStr);
    } catch (_err) {
      // silently fallback to default
    }

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
