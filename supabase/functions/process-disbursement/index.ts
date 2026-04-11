/**
 * process-disbursement
 *
 * Called after a disbursement_memo is approved.
 * Checks if the org has an active PSP config:
 *   - PSP active  → calls PSP API, posts journal entries immediately on confirmation
 *   - No PSP      → creates disbursement_advice for manual credit-manager confirmation
 *                   Journals are posted ONLY when credit manager marks "completed"
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { disbursement_memo_id } = await req.json();
    if (!disbursement_memo_id) {
      return errorResponse("disbursement_memo_id is required");
    }

    // ── 1. Fetch the disbursement memo ──────────────────────────────────────
    const { data: memo, error: memoErr } = await supabase
      .from("disbursement_memos")
      .select(`
        id, organization_id, invoice_id, borrower_id,
        disbursement_amount, currency, status, journals_posted,
        disbursement_mode,
        invoices ( invoice_number, counterparty_name )
      `)
      .eq("id", disbursement_memo_id)
      .single();

    if (memoErr || !memo) {
      return errorResponse(`Disbursement memo not found: ${memoErr?.message}`);
    }

    if (memo.status !== "approved") {
      return errorResponse(`Memo status is '${memo.status}', expected 'approved'`);
    }

    if (memo.journals_posted) {
      return jsonResponse({ mode: memo.disbursement_mode, already_processed: true });
    }

    // ── 2. Check for active PSP config ──────────────────────────────────────
    const { data: pspConfig } = await supabase
      .from("psp_configs")
      .select("*")
      .eq("organization_id", memo.organization_id)
      .eq("is_active", true)
      .maybeSingle();

    if (pspConfig) {
      // ── PSP PATH ──────────────────────────────────────────────────────────
      return await handlePspDisbursement(supabase, memo, pspConfig);
    } else {
      // ── MANUAL PATH ───────────────────────────────────────────────────────
      return await handleManualDisbursement(supabase, memo);
    }
  } catch (err: any) {
    console.error("[process-disbursement] Unexpected error:", err);
    return errorResponse(err.message || "Internal server error", 500);
  }
});

// ── PSP Path ─────────────────────────────────────────────────────────────────

async function handlePspDisbursement(supabase: any, memo: any, pspConfig: any) {
  const amount = Number(memo.disbursement_amount);
  const currency = memo.currency || "GBP";

  // Ensure psp_virtual_accounts exist for originator (payer) and borrower (payee)
  const payerAccount = await ensurePspAccount(supabase, {
    organization_id: memo.organization_id,
    actor_id: memo.organization_id, // originator acts as payer
    actor_type: "originator",
    psp_provider: pspConfig.psp_provider,
    currency,
  });

  const payeeAccount = await ensurePspAccount(supabase, {
    organization_id: memo.organization_id,
    actor_id: memo.borrower_id,
    actor_type: "borrower",
    psp_provider: pspConfig.psp_provider,
    currency,
  });

  // Create payment instruction
  const { data: instruction, error: instrErr } = await supabase
    .from("payment_instructions")
    .insert({
      organization_id: memo.organization_id,
      payer_psp_account_id: payerAccount.id,
      payee_psp_account_id: payeeAccount.id,
      amount,
      currency,
      status: "submitted",
    })
    .select("id")
    .single();

  if (instrErr) {
    throw new Error(`Failed to create payment instruction: ${instrErr.message}`);
  }

  // Call PSP API
  let pspRef: string | null = null;
  let pspSuccess = false;
  try {
    pspRef = await callPspApi(pspConfig, {
      amount,
      currency,
      payerRef: payerAccount.psp_account_ref,
      payeeRef: payeeAccount.psp_account_ref,
      reference: `DISB-${memo.id.slice(0, 8).toUpperCase()}`,
      description: `Disbursement ${memo.invoices?.invoice_number || memo.id}`,
    });
    pspSuccess = true;
  } catch (pspErr: any) {
    console.error("[process-disbursement] PSP call failed:", pspErr.message);
    // Mark instruction as failed
    await supabase
      .from("payment_instructions")
      .update({ status: "failed", failure_reason: pspErr.message })
      .eq("id", instruction.id);

    // Fall back to manual advice
    console.log("[process-disbursement] PSP failed — falling back to manual advice");
    await supabase
      .from("disbursement_memos")
      .update({ disbursement_mode: "manual" })
      .eq("id", memo.id);
    return handleManualDisbursement(supabase, { ...memo, disbursement_mode: "manual" });
  }

  // PSP succeeded — update instruction and memo
  await supabase
    .from("payment_instructions")
    .update({ status: "confirmed", psp_reference: pspRef, psp_confirmed_at: new Date().toISOString() })
    .eq("id", instruction.id);

  await supabase
    .from("disbursement_memos")
    .update({
      disbursement_mode: "psp",
      psp_payment_instruction_id: instruction.id,
      status: "disbursed",
      disbursed_at: new Date().toISOString(),
      payment_reference: pspRef,
    })
    .eq("id", memo.id);

  // Post journal entries immediately (PSP = confirmed)
  await postDisbursementJournals(supabase, memo, pspRef);

  await supabase.from("disbursement_memos").update({ journals_posted: true }).eq("id", memo.id);

  return jsonResponse({ mode: "psp", psp_reference: pspRef, instruction_id: instruction.id });
}

// ── Manual Path ───────────────────────────────────────────────────────────────

async function handleManualDisbursement(supabase: any, memo: any) {
  // Create disbursement_advice record
  const { data: advice, error: advErr } = await supabase
    .from("disbursement_advices")
    .insert({
      organization_id: memo.organization_id,
      disbursement_memo_id: memo.id,
      advice_number: "", // trigger sets this
      status: "pending",
    })
    .select("id, advice_number")
    .single();

  if (advErr) {
    throw new Error(`Failed to create disbursement advice: ${advErr.message}`);
  }

  await supabase
    .from("disbursement_memos")
    .update({ disbursement_mode: "manual" })
    .eq("id", memo.id);

  // Notify operations_manager users in the org
  const { data: opsUsers } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "operations_manager");

  if (opsUsers && opsUsers.length > 0) {
    await supabase.from("notifications").insert(
      opsUsers.map((u: any) => ({
        organization_id: memo.organization_id,
        user_id: u.user_id,
        notification_type: "disbursement_advice_pending",
        message: `Disbursement Advice ${advice.advice_number} requires manual confirmation. Amount: ${memo.currency || "GBP"} ${Number(memo.disbursement_amount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}. Please upload bank statement to confirm.`,
        reference_id: advice.id,
        reference_type: "disbursement_advice",
      }))
    );
  }

  return jsonResponse({ mode: "manual", advice_id: advice.id, advice_number: advice.advice_number });
}

// ── Journal Posting ───────────────────────────────────────────────────────────

async function postDisbursementJournals(supabase: any, memo: any, paymentRef: string | null) {
  const amount = Number(memo.disbursement_amount);
  const currency = memo.currency || "GBP";
  const orgId = memo.organization_id;

  // Double-entry: cash out of originator funding account, into borrower disbursement
  const entries = [
    {
      organization_id: orgId,
      journal_type: "disbursement",
      reference_id: memo.id,
      account_id: memo.borrower_id || null,
      system_account: "borrower_disbursement_receivable",
      amount,
      direction: "debit",
      currency,
      description: `Disbursement to borrower — ${memo.invoices?.invoice_number || memo.id} | ref: ${paymentRef || "manual"}`,
    },
    {
      organization_id: orgId,
      journal_type: "disbursement",
      reference_id: memo.id,
      account_id: null,
      system_account: "originator_funding_account",
      amount,
      direction: "credit",
      currency,
      description: `Disbursement funded — ${memo.invoices?.invoice_number || memo.id} | ref: ${paymentRef || "manual"}`,
    },
  ];

  const { error } = await supabase.rpc("post_journal_batch", { entries });
  if (error) {
    throw new Error(`Journal posting failed: ${error.message}`);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ensurePspAccount(supabase: any, params: {
  organization_id: string;
  actor_id: string;
  actor_type: string;
  psp_provider: string;
  currency: string;
}) {
  const { data: existing } = await supabase
    .from("psp_virtual_accounts")
    .select("*")
    .eq("actor_id", params.actor_id)
    .eq("currency", params.currency)
    .eq("status", "active")
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("psp_virtual_accounts")
    .insert({
      organization_id: params.organization_id,
      actor_id: params.actor_id,
      actor_type: params.actor_type,
      psp_provider: params.psp_provider,
      currency: params.currency,
      status: "active",
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create PSP account: ${error.message}`);
  return created;
}

async function callPspApi(config: any, payment: {
  amount: number;
  currency: string;
  payerRef: string | null;
  payeeRef: string | null;
  reference: string;
  description: string;
}): Promise<string> {
  // Provider-specific routing
  if (config.psp_provider === "modulr") {
    return callModulrApi(config, payment);
  }
  if (config.psp_provider === "railsr") {
    return callRailsrApi(config, payment);
  }
  // Unknown provider — throw so we fall back to manual
  throw new Error(`PSP provider '${config.psp_provider}' integration not yet implemented`);
}

async function callModulrApi(config: any, payment: any): Promise<string> {
  const apiKey = config.credentials_vault_key
    ? Deno.env.get(config.credentials_vault_key) || null
    : null;

  if (!apiKey) {
    throw new Error("Modulr API key not configured in Supabase secrets");
  }

  const baseUrl = config.api_base_url || "https://api-sandbox.modulrfinance.com/api-sandbox";

  const res = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${btoa(apiKey + ":")}`,
    },
    body: JSON.stringify({
      sourceAccountId: payment.payerRef,
      destination: {
        type: "ACCOUNT",
        id: payment.payeeRef,
      },
      currency: payment.currency,
      amount: payment.amount,
      reference: payment.reference,
      externalReference: payment.reference,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Modulr API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.id || data.paymentId || payment.reference;
}

async function callRailsrApi(config: any, payment: any): Promise<string> {
  const apiKey = config.credentials_vault_key
    ? Deno.env.get(config.credentials_vault_key) || null
    : null;

  if (!apiKey) {
    throw new Error("Railsr API key not configured in Supabase secrets");
  }

  const baseUrl = config.api_base_url || "https://api.railsbank.com";

  const res = await fetch(`${baseUrl}/v1/customer/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `API-Key ${apiKey}`,
    },
    body: JSON.stringify({
      ledger_from_id: payment.payerRef,
      ledger_to_id: payment.payeeRef,
      amount: payment.amount,
      currency: payment.currency,
      payment_ref: payment.reference,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Railsr API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.transaction_id || payment.reference;
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
