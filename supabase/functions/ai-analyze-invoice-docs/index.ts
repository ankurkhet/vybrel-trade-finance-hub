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
            content: `Analyze these ${documents.length} documents uploaded for an invoice submission:\n\n${documentList}\n\nClassify each document, extract invoice details from the primary invoice, and identify any cross-document discrepancies or observations.`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "invoice_document_analysis",
            description: "Return complete analysis of invoice submission documents",
            parameters: {
              type: "object",
              properties: {
                document_classifications: {
                  type: "array",
                  description: "Classification for each uploaded document",
                  items: {
                    type: "object",
                    properties: {
                      file_name: { type: "string" },
                      tag: { type: "string", enum: ["invoice", "proof_of_delivery", "packaging_slip", "sales_quote", "purchase_order", "banking_note", "buyer_email", "contract", "credit_note", "statement_of_account", "bill_of_lading", "insurance_certificate", "other"] },
                      confidence: { type: "number", description: "0-100 confidence" },
                      description: { type: "string", description: "Brief description of the document" },
                    },
                    required: ["file_name", "tag", "confidence"],
                  },
                },
                extracted_invoice_data: {
                  type: "object",
                  properties: {
                    invoice_number: { type: "string" },
                    invoice_date: { type: "string" },
                    due_date: { type: "string" },
                    buyer_name: { type: "string" },
                    buyer_address: { type: "string" },
                    buyer_tax_id: { type: "string" },
                    seller_name: { type: "string" },
                    seller_address: { type: "string" },
                    seller_tax_id: { type: "string" },
                    subtotal: { type: "number" },
                    tax_amount: { type: "number" },
                    total_amount: { type: "number" },
                    currency: { type: "string" },
                    line_items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          description: { type: "string" },
                          quantity: { type: "number" },
                          unit_price: { type: "number" },
                          total: { type: "number" },
                        },
                        required: ["description"],
                      },
                    },
                  },
                },
                observations: {
                  type: "array",
                  description: "Cross-document discrepancies and notable observations",
                  items: {
                    type: "object",
                    properties: {
                      severity: { type: "string", enum: ["info", "warning", "critical"] },
                      title: { type: "string" },
                      description: { type: "string" },
                      documents_involved: { type: "array", items: { type: "string" } },
                    },
                    required: ["severity", "title", "description"],
                  },
                },
                missing_documents: {
                  type: "array",
                  description: "Expected documents that appear to be missing",
                  items: { type: "string" },
                },
                summary: { type: "string", description: "Brief overall summary of the submission" },
              },
              required: ["document_classifications", "extracted_invoice_data", "observations", "summary"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "invoice_document_analysis" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
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
    const analysis = toolCall ? JSON.parse(toolCall.function.arguments) : {};

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
