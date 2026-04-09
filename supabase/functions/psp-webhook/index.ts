// PSP Webhook Handler
// Called by the licensed PSP when a payment instruction is confirmed or fails.
// Updates payment_instructions status and creates the corresponding journal entry.
// Secured by a shared webhook secret in the Authorization header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret
    const authHeader = req.headers.get("authorization");
    const webhookSecret = Deno.env.get("PSP_WEBHOOK_SECRET");
    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { psp_reference, status, confirmed_at, failure_reason } = body;

    if (!psp_reference || !status) {
      return new Response(JSON.stringify({ error: "Missing psp_reference or status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Find the payment instruction
    const { data: instruction, error: findErr } = await supabase
      .from("payment_instructions")
      .select("*, settlement_advices(organization_id, advice_type, net_amount, currency, to_funder_user_id, invoice_id)")
      .eq("psp_reference", psp_reference)
      .maybeSingle();

    if (findErr || !instruction) {
      // Try to find by reference in a submitted state
      console.warn(`[psp-webhook] No instruction found for psp_reference: ${psp_reference}`);
      return new Response(JSON.stringify({ error: "Payment instruction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update payment instruction status
    const updatePayload: any = {
      status,
      failure_reason: failure_reason || null,
    };
    if (status === "confirmed") {
      updatePayload.psp_confirmed_at = confirmed_at || new Date().toISOString();
    }

    await supabase
      .from("payment_instructions")
      .update(updatePayload)
      .eq("id", instruction.id);

    // On confirmation: create journal entry (debit originator, credit funder)
    if (status === "confirmed") {
      const advice = (instruction as any).settlement_advices;
      if (advice) {
        const { error: journalErr } = await supabase.from("journals").insert({
          organization_id: advice.organization_id,
          entry_type: "psp_settlement_confirmed",
          description: `PSP payment confirmed: ${psp_reference}`,
          amount: instruction.amount,
          currency: instruction.currency,
          debit_account: "originator_payable",
          credit_account: advice.advice_type === "funder_settlement" ? "funder_wallet" : "borrower_wallet",
          reference_id: instruction.settlement_advice_id,
          reference_type: "settlement_advice",
          metadata: {
            psp_reference,
            payment_instruction_id: instruction.id,
            confirmed_at: updatePayload.psp_confirmed_at,
          },
        });

        if (journalErr) {
          console.error("[psp-webhook] Failed to create journal entry:", journalErr);
        }
      }
    }

    console.log(`[psp-webhook] Processed ${psp_reference}: ${status}`);
    return new Response(
      JSON.stringify({ success: true, instruction_id: instruction.id, status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[psp-webhook] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
