import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAIClient } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-version",
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

    const { documents } = await req.json();
    // documents: array of { document_id, file_name, file_path, mime_type, file_size }

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response(JSON.stringify({ error: "No documents provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a trade finance document analyst. You receive a batch of documents related to an invoice submission. For each document, you must:

1. **Classify/Tag** the document as one of: "invoice", "proof_of_delivery", "packaging_slip", "sales_quote", "purchase_order", "banking_note", "buyer_email", "contract", "credit_note", "statement_of_account", "bill_of_lading", "insurance_certificate", "other"
2. **Extract key data** from the primary invoice document including:
   - invoice_number, invoice_date, due_date
   - buyer_name, buyer_address, buyer_tax_id
   - seller_name, seller_address, seller_tax_id
   - subtotal, tax_amount, total_amount, currency
   - line_items: array of { description, quantity, unit_price, total }
3. **Cross-reference** all documents and identify observations/discrepancies such as:
   - Mismatch between PO and Invoice amounts
   - Quantity mismatch between invoice and packaging slip
   - Invoice value vs PO value discrepancy
   - Missing expected documents
   - Date inconsistencies
   - Name/address mismatches across documents

Return structured results via the tool call.`;

    const documentList = documents.map((d: any, i: number) =>
      `Document ${i + 1}: "${d.file_name}" (${d.mime_type || 'unknown type'}, ${d.file_size ? Math.round(d.file_size / 1024) + 'KB' : 'unknown size'})`
    ).join("\n");

    const userPrompt = `Analyze these ${documents.length} documents uploaded for an invoice submission:\n\n${documentList}\n\nClassify each document, extract invoice details from the primary invoice, and identify any cross-document discrepancies or observations.

Return a valid JSON object (no markdown fences) with:
{
  "document_classifications": [{"file_name": "", "tag": "invoice|proof_of_delivery|packaging_slip|sales_quote|purchase_order|banking_note|buyer_email|contract|credit_note|statement_of_account|bill_of_lading|insurance_certificate|other", "confidence": 100, "description": ""}],
  "extracted_invoice_data": {
    "invoice_number": "", "invoice_date": "", "due_date": "",
    "buyer_name": "", "buyer_address": "", "buyer_tax_id": "",
    "seller_name": "", "seller_address": "", "seller_tax_id": "",
    "subtotal": 0, "tax_amount": 0, "total_amount": 0, "currency": "USD",
    "line_items": [{"description": "", "quantity": 1, "unit_price": 0, "total": 0}]
  },
  "observations": [{"severity": "info|warning|critical", "title": "", "description": "", "documents_involved": []}],
  "missing_documents": [],
  "summary": ""
}`;

    const rawText = await ai.complete(systemPrompt, userPrompt, { maxTokens: 2048, temperature: 0.1 });
    const jsonStr = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
    const analysis = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
