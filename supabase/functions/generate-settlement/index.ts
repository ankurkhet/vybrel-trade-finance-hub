import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FeeConfig {
  originator_fee_pct: number;
  platform_fee_pct: number;
  default_discount_rate: number;
  settlement_days: number;
  payment_instructions: any;
}

const DEFAULT_FEE_CONFIG: FeeConfig = {
  originator_fee_pct: 2,
  platform_fee_pct: 0.5,
  default_discount_rate: 5,
  settlement_days: 1,
  payment_instructions: {},
};

function generateAdviceNumber(type: string, index: number): string {
  const prefix = type === "borrower_settlement" ? "SA-B" : "SA-F";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${date}-${String(index).padStart(4, "0")}`;
}

interface FacilityRate {
  final_discounting_rate: number | null;
  advance_rate: number | null;
  overdue_fee_pct: number | null;
  settlement_type: "advance" | "accrual" | null;
}

interface SettlementResult {
  discountAmount: number;
  originatorFee: number;
  platformFee: number;
  brokerFee: number;
  netAmount: number;
  feeBreakdown: any[];
  effectiveDiscount: number;
  // Net margin = originator_fee - (platform costs) — positive means profitable
  netMarginAmount: number;
  netMarginPct: number;
}

function calculateSettlement(
  grossAmount: number,
  feeConfig: FeeConfig,
  productType: string,
  facilityRate?: FacilityRate | null,
  discountRate?: number,
  brokerFeePct?: number | null
): SettlementResult {
  // Priority: 1) explicit discountRate, 2) facility contracted rate, 3) product fee config default
  const effectiveDiscount =
    discountRate ??
    facilityRate?.final_discounting_rate ??
    feeConfig.default_discount_rate;

  let originatorFeePct = feeConfig.originator_fee_pct;
  let platformFeePct = feeConfig.platform_fee_pct;

  switch (productType) {
    case "receivables_purchase":
      break;
    case "reverse_factoring":
      originatorFeePct = Math.max(originatorFeePct * 0.75, 0);
      break;
    case "payables_finance":
      platformFeePct = platformFeePct * 1.25;
      break;
  }

  const discountAmount = (grossAmount * effectiveDiscount) / 100;
  const originatorFee = (grossAmount * originatorFeePct) / 100;
  const platformFee = (grossAmount * platformFeePct) / 100;
  const effectiveBrokerPct = brokerFeePct ?? 0;
  const brokerFee = (grossAmount * effectiveBrokerPct) / 100;
  const totalDeductions = discountAmount + originatorFee + platformFee + brokerFee;
  const netAmount = grossAmount - totalDeductions;

  // Net margin: what originator keeps after platform and broker costs
  // = originator_fee - broker_fee - platform_fee
  const netMarginAmount = originatorFee - brokerFee - platformFee;
  const netMarginPct = grossAmount > 0 ? (netMarginAmount / grossAmount) * 100 : 0;

  const feeBreakdown = [
    { label: "Gross Collection", amount: grossAmount, type: "gross" },
    { label: `Discount (${effectiveDiscount.toFixed(2)}%)`, amount: -discountAmount, type: "discount" },
    { label: `Originator Fee (${originatorFeePct.toFixed(2)}%)`, amount: -originatorFee, type: "fee" },
    { label: `Platform Fee (${platformFeePct.toFixed(2)}%)`, amount: -platformFee, type: "fee" },
    ...(effectiveBrokerPct > 0 ? [{ label: `Broker Fee (${effectiveBrokerPct.toFixed(2)}%)`, amount: -brokerFee, type: "fee" }] : []),
    { label: "Net Settlement to Borrower", amount: netAmount, type: "net" },
  ];

  return {
    discountAmount, originatorFee, platformFee, brokerFee,
    netAmount, feeBreakdown, effectiveDiscount,
    netMarginAmount, netMarginPct,
  };
}

function calculateFunderReturn(
  fundedAmount: number,
  discountRate: number,
  daysFunded: number,
  feeConfig: FeeConfig
) {
  const annualizedYield = (fundedAmount * discountRate * daysFunded) / (100 * 365);
  const platformFee = (annualizedYield * feeConfig.platform_fee_pct) / 100;
  const netReturn = fundedAmount + annualizedYield - platformFee;

  const feeBreakdown = [
    { label: "Funded Amount (Principal)", amount: fundedAmount, type: "gross" },
    { label: `Yield (${discountRate}% p.a. × ${daysFunded} days)`, amount: annualizedYield, type: "yield" },
    { label: `Platform Fee (${feeConfig.platform_fee_pct}%)`, amount: -platformFee, type: "fee" },
    { label: "Net Settlement to Funder", amount: netReturn, type: "net" },
  ];

  return { yield: annualizedYield, platformFee, netReturn, feeBreakdown };
}

/**
 * Posts a balanced double-entry journal batch via the post_journal_batch RPC.
 * All amounts must sum to zero (debits = credits) within one currency.
 */
async function postJournalBatch(
  supabase: ReturnType<typeof createClient>,
  entries: object[]
): Promise<void> {
  const { error } = await supabase.rpc("post_journal_batch", { entries });
  if (error) {
    console.error("[generate-settlement] Journal batch failed:", error.message);
    // Non-fatal — settlement advice is already created; log but continue
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { collection_id } = await req.json();

    if (!collection_id) {
      return new Response(
        JSON.stringify({ error: "collection_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch collection with invoice and borrower details
    const { data: collection, error: colErr } = await supabase
      .from("collections")
      .select("*, invoices(*, borrowers(id, company_name, contact_email, user_id))")
      .eq("id", collection_id)
      .single();

    if (colErr || !collection) {
      return new Response(
        JSON.stringify({ error: "Collection not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invoice = collection.invoices;
    if (!invoice) {
      return new Response(
        JSON.stringify({ error: "Invoice not found for collection" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch facility rate via disbursement_memos → facility_requests
    // Also try to read settlement_type from the linked facility record
    let facilityRate: FacilityRate | null = null;
    let advancePaid = 0;

    const { data: disbursementMemo } = await supabase
      .from("disbursement_memos")
      .select("facility_request_id, disbursement_amount")
      .eq("invoice_id", invoice.id)
      .not("facility_request_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (disbursementMemo?.facility_request_id) {
      const { data: facility } = await supabase
        .from("facility_requests")
        .select("final_discounting_rate, advance_rate, overdue_fee_pct, settlement_type")
        .eq("id", disbursementMemo.facility_request_id)
        .single();

      if (facility) {
        facilityRate = facility as FacilityRate;

        // Under advance settlement, the borrower already received disbursement_amount upfront
        if (facilityRate.settlement_type === "advance" && disbursementMemo.disbursement_amount) {
          advancePaid = Number(disbursementMemo.disbursement_amount);
        }
      }
    }

    // Fetch organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", collection.organization_id)
      .single();

    const orgName = org?.name || "Originator";

    // Fetch product fee config (fallback rates)
    const { data: feeConfigData } = await supabase
      .from("product_fee_configs")
      .select("*")
      .eq("organization_id", collection.organization_id)
      .eq("product_type", invoice.product_type || "receivables_purchase")
      .maybeSingle();

    const feeConfig: FeeConfig = feeConfigData || DEFAULT_FEE_CONFIG;
    const brokerFeePct = (feeConfigData as any)?.broker_fee_pct ?? 0;
    const advices: any[] = [];
    const currency: string = collection.currency || "GBP";
    const orgId: string = collection.organization_id;

    // Count existing advices for numbering
    const { count } = await supabase
      .from("settlement_advices")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);

    let adviceIndex = (count || 0) + 1;

    // -----------------------------------------------------------------------
    // 1. BORROWER SETTLEMENT ADVICE
    // -----------------------------------------------------------------------
    const borrower = invoice.borrowers;
    if (borrower) {
      const settlement = calculateSettlement(
        collection.collected_amount,
        feeConfig,
        invoice.product_type || "receivables_purchase",
        facilityRate,
        undefined,
        brokerFeePct
      );

      const settlementType: "advance" | "accrual" =
        (facilityRate?.settlement_type as "advance" | "accrual") ?? "accrual";

      // Under advance settlement: borrower only receives the residual
      const remainingBalance =
        settlementType === "advance"
          ? settlement.netAmount - advancePaid
          : settlement.netAmount;

      const isNegativeMargin = settlement.netMarginAmount < 0 || settlement.netAmount < 0;

      const borrowerAdvice: any = {
        organization_id: orgId,
        collection_id: collection.id,
        advice_number: generateAdviceNumber("borrower_settlement", adviceIndex++),
        advice_type: "borrower_settlement" as const,
        from_party_name: orgName,
        to_party_name: borrower.company_name,
        to_party_email: borrower.contact_email,
        to_borrower_id: borrower.id,
        invoice_id: invoice.id,
        product_type: invoice.product_type || "receivables_purchase",
        gross_amount: collection.collected_amount,
        discount_amount: settlement.discountAmount,
        originator_fee: settlement.originatorFee,
        platform_fee: settlement.platformFee,
        net_amount: settlement.netAmount,
        currency,
        fee_breakdown: settlement.feeBreakdown,
        payment_instructions: feeConfig.payment_instructions || {},
        status: "issued" as const,
        issued_at: new Date().toISOString(),
        // New columns (Fix E)
        settlement_type: settlementType,
        advance_paid: advancePaid,
        remaining_balance: remainingBalance,
        net_margin_amount: settlement.netMarginAmount,
        net_margin_pct: settlement.netMarginPct,
        negative_margin: isNegativeMargin,
        metadata: {
          rate_source: facilityRate?.final_discounting_rate ? "facility" : "product_fee_config",
          effective_discount_rate: settlement.effectiveDiscount,
        },
      };

      const { data: ba, error: baErr } = await supabase
        .from("settlement_advices")
        .insert(borrowerAdvice)
        .select()
        .single();

      if (baErr) {
        console.error("Failed to create borrower settlement:", baErr);
      } else {
        advices.push(ba);

        // ── Fix D: Negative net margin alert ──────────────────────────────
        if (isNegativeMargin) {
          const alertMsg = settlement.netAmount < 0
            ? `Invoice ${invoice.invoice_number}: borrower net amount is ${currency} ${settlement.netAmount.toFixed(2)} (negative). Fees exceed collection.`
            : `Invoice ${invoice.invoice_number}: originator net margin is ${currency} ${settlement.netMarginAmount.toFixed(2)} (${settlement.netMarginPct.toFixed(2)}%). Review fee configuration.`;

          await supabase.from("notifications").insert({
            organization_id: orgId,
            notification_type: "negative_net_margin",
            title: "Negative Net Margin Alert",
            message: alertMsg,
          });

          console.warn("[generate-settlement] NEGATIVE MARGIN:", alertMsg);
        }

        // ── Fix C: Post balanced journal entries for borrower settlement ──
        //
        // DEBIT  collections_clearing  gross_collection   (cash received from debtor)
        // CREDIT funder_yield_payable  discount_amount    (owed to funder pool)
        // CREDIT originator_revenue    originator_fee     (originator earns fee)
        // CREDIT platform_revenue      platform_fee       (platform earns fee)
        // CREDIT broker_revenue        broker_fee         (broker cut, 0 if none)
        // CREDIT borrower_net_settlement net_amount       (borrower receives)
        //
        // Sum of credits = discount + origFee + platFee + brokFee + netAmount = gross ✓

        const grossAmount = Number(collection.collected_amount);
        const borrowerUserId: string | null = borrower.user_id || null;

        const borrowerJournalEntries: object[] = [
          {
            organization_id: orgId,
            journal_type: "collection",
            reference_id: ba.id,
            account_id: null,
            system_account: "collections_clearing",
            amount: grossAmount,
            direction: "debit",
            currency,
            description: `Collection received: ${invoice.invoice_number}`,
          },
          {
            organization_id: orgId,
            journal_type: "margin",
            reference_id: ba.id,
            account_id: null,
            system_account: "funder_yield_payable",
            amount: settlement.discountAmount,
            direction: "credit",
            currency,
            description: `Funder yield (${settlement.effectiveDiscount.toFixed(2)}%): ${invoice.invoice_number}`,
          },
          {
            organization_id: orgId,
            journal_type: "fee",
            reference_id: ba.id,
            account_id: null,
            system_account: "originator_revenue",
            amount: settlement.originatorFee,
            direction: "credit",
            currency,
            description: `Originator fee: ${invoice.invoice_number}`,
          },
          {
            organization_id: orgId,
            journal_type: "fee",
            reference_id: ba.id,
            account_id: null,
            system_account: "platform_revenue",
            amount: settlement.platformFee,
            direction: "credit",
            currency,
            description: `Platform fee: ${invoice.invoice_number}`,
          },
          ...(settlement.brokerFee > 0 ? [{
            organization_id: orgId,
            journal_type: "fee",
            reference_id: ba.id,
            account_id: null,
            system_account: "broker_revenue",
            amount: settlement.brokerFee,
            direction: "credit",
            currency,
            description: `Broker fee: ${invoice.invoice_number}`,
          }] : []),
          {
            organization_id: orgId,
            journal_type: "collection",
            reference_id: ba.id,
            account_id: borrowerUserId,
            system_account: "borrower_net_settlement",
            amount: settlement.netAmount,
            direction: "credit",
            currency,
            description: `Net settlement to borrower: ${invoice.invoice_number}`,
          },
        ];

        await postJournalBatch(supabase, borrowerJournalEntries);
      }
    }

    // -----------------------------------------------------------------------
    // 2. FUNDER SETTLEMENT ADVICE (if invoice was funded)
    // -----------------------------------------------------------------------
    const { data: fundingOffers } = await supabase
      .from("funding_offers")
      .select("*")
      .eq("invoice_id", invoice.id)
      .eq("status", "accepted");

    if (fundingOffers && fundingOffers.length > 0) {
      for (const offer of fundingOffers) {
        const fundedDate = new Date(offer.accepted_at || offer.offered_at);
        const collectionDate = new Date(collection.collection_date);
        const daysFunded = Math.max(1, Math.ceil(
          (collectionDate.getTime() - fundedDate.getTime()) / (1000 * 60 * 60 * 24)
        ));

        // Use facility rate if available, then offer rate, then default
        const effectiveFunderRate =
          facilityRate?.final_discounting_rate ??
          offer.discount_rate ??
          feeConfig.default_discount_rate;

        const funderReturn = calculateFunderReturn(
          offer.offer_amount,
          effectiveFunderRate,
          daysFunded,
          feeConfig
        );

        // Get funder profile — use user_id column (live DB schema)
        const { data: funderProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", offer.funder_user_id)
          .single();

        const funderAdvice: any = {
          organization_id: orgId,
          collection_id: collection.id,
          advice_number: generateAdviceNumber("funder_settlement", adviceIndex++),
          advice_type: "funder_settlement" as const,
          from_party_name: orgName,
          to_party_name: funderProfile?.full_name || "Funder",
          to_party_email: funderProfile?.email,
          to_funder_user_id: offer.funder_user_id,
          invoice_id: invoice.id,
          product_type: invoice.product_type || "receivables_purchase",
          gross_amount: offer.offer_amount,
          discount_amount: 0,
          originator_fee: 0,
          platform_fee: funderReturn.platformFee,
          net_amount: funderReturn.netReturn,
          currency,
          fee_breakdown: funderReturn.feeBreakdown,
          payment_instructions: feeConfig.payment_instructions || {},
          status: "issued" as const,
          issued_at: new Date().toISOString(),
          // New columns
          settlement_type: (facilityRate?.settlement_type as "advance" | "accrual") ?? "accrual",
          advance_paid: 0,
          remaining_balance: funderReturn.netReturn,
          net_margin_amount: funderReturn.platformFee,
          net_margin_pct: offer.offer_amount > 0
            ? (funderReturn.platformFee / offer.offer_amount) * 100 : 0,
          negative_margin: false,
          metadata: {
            days_funded: daysFunded,
            discount_rate: effectiveFunderRate,
            rate_source: facilityRate?.final_discounting_rate
              ? "facility"
              : (offer.discount_rate ? "offer" : "product_fee_config"),
            yield_amount: funderReturn.yield,
          },
        };

        const { data: fa, error: faErr } = await supabase
          .from("settlement_advices")
          .insert(funderAdvice)
          .select()
          .single();

        if (faErr) {
          console.error("Failed to create funder settlement:", faErr);
        } else {
          advices.push(fa);

          // ── Fix C: Balanced journal for funder settlement ─────────────
          //
          // DEBIT  funder_yield_payable   netReturn   (clear funder pool liability)
          // CREDIT funder_net_settlement  netReturn   (funder receives principal + yield)

          const funderJournalEntries: object[] = [
            {
              organization_id: orgId,
              journal_type: "margin",
              reference_id: fa.id,
              account_id: offer.funder_user_id,
              system_account: "funder_yield_payable",
              amount: funderReturn.netReturn,
              direction: "debit",
              currency,
              description: `Funder payout (principal+yield): ${invoice.invoice_number}`,
            },
            {
              organization_id: orgId,
              journal_type: "collection",
              reference_id: fa.id,
              account_id: offer.funder_user_id,
              system_account: "funder_net_settlement",
              amount: funderReturn.netReturn,
              direction: "credit",
              currency,
              description: `Net to funder: ${invoice.invoice_number}`,
            },
          ];

          await postJournalBatch(supabase, funderJournalEntries);

          // ── PSP payment instruction ───────────────────────────────────
          const getOrCreatePspAccount = async (actorId: string, actorType: string) => {
            const { data: existing } = await supabase
              .from("psp_virtual_accounts")
              .select("id")
              .eq("actor_id", actorId)
              .eq("currency", currency)
              .eq("organization_id", orgId)
              .maybeSingle();
            if (existing) return existing.id;
            const { data: created } = await supabase
              .from("psp_virtual_accounts")
              .insert({
                organization_id: orgId,
                actor_id: actorId,
                actor_type: actorType,
                currency,
                psp_provider: "manual",
              })
              .select("id")
              .single();
            return created?.id;
          };

          try {
            const [payerAccountId, payeeAccountId] = await Promise.all([
              getOrCreatePspAccount(orgId, "originator"),
              getOrCreatePspAccount(offer.funder_user_id, "funder"),
            ]);
            await supabase.from("payment_instructions").insert({
              organization_id: orgId,
              settlement_advice_id: fa.id,
              payer_psp_account_id: payerAccountId,
              payee_psp_account_id: payeeAccountId,
              amount: funderReturn.netReturn,
              currency,
              status: "pending",
            });
          } catch (piErr) {
            console.warn("[generate-settlement] Could not create payment_instruction:", piErr);
          }
        }
      }
    }

    // Update invoice status to collected
    await supabase
      .from("invoices")
      .update({ status: "collected" })
      .eq("id", invoice.id);

    // Update collection status to confirmed
    await supabase
      .from("collections")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", collection_id);

    // Record invocation in platform_api_configs
    await supabase
      .from("platform_api_configs")
      .update({ last_invoked_at: new Date().toISOString(), health_status: "healthy" })
      .eq("api_name", "generate-settlement");

    return new Response(
      JSON.stringify({
        success: true,
        advices_generated: advices.length,
        advices,
        negative_margin_alerts: advices.filter((a) => a.negative_margin).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[generate-settlement] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
