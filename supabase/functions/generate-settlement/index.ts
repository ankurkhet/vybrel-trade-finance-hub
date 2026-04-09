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
}

function calculateSettlement(
  grossAmount: number,
  feeConfig: FeeConfig,
  productType: string,
  facilityRate?: FacilityRate | null,
  discountRate?: number,
  brokerFeePct?: number | null
) {
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

  const feeBreakdown = [
    { label: "Gross Collection", amount: grossAmount, type: "gross" },
    { label: `Discount (${effectiveDiscount}%)`, amount: -discountAmount, type: "discount" },
    { label: `Originator Fee (${originatorFeePct}%)`, amount: -originatorFee, type: "fee" },
    { label: `Platform Fee (${platformFeePct}%)`, amount: -platformFee, type: "fee" },
    ...(effectiveBrokerPct > 0 ? [{ label: `Broker Fee (${effectiveBrokerPct}%)`, amount: -brokerFee, type: "fee" }] : []),
    { label: "Net Settlement", amount: netAmount, type: "net" },
  ];

  return { discountAmount, originatorFee, platformFee, brokerFee, netAmount, feeBreakdown, effectiveDiscount };
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
    { label: "Net Settlement", amount: netReturn, type: "net" },
  ];

  return { yield: annualizedYield, platformFee, netReturn, feeBreakdown };
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
    let facilityRate: FacilityRate | null = null;
    const { data: disbursementMemo } = await supabase
      .from("disbursement_memos")
      .select("facility_request_id")
      .eq("invoice_id", invoice.id)
      .not("facility_request_id", "is", null)
      .limit(1)
      .single();

    if (disbursementMemo?.facility_request_id) {
      const { data: facility } = await supabase
        .from("facility_requests")
        .select("final_discounting_rate, advance_rate, overdue_fee_pct")
        .eq("id", disbursementMemo.facility_request_id)
        .single();

      if (facility) {
        facilityRate = facility as FacilityRate;
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
      .single();

    const feeConfig: FeeConfig = feeConfigData || DEFAULT_FEE_CONFIG;
    const brokerFeePct = (feeConfigData as any)?.broker_fee_pct ?? 0;
    const advices: any[] = [];

    // Count existing advices for numbering
    const { count } = await supabase
      .from("settlement_advices")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", collection.organization_id);

    let adviceIndex = (count || 0) + 1;

    // 1. Generate Borrower Settlement Advice
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

      const borrowerAdvice = {
        organization_id: collection.organization_id,
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
        currency: collection.currency,
        fee_breakdown: settlement.feeBreakdown,
        payment_instructions: feeConfig.payment_instructions || {},
        status: "issued" as const,
        issued_at: new Date().toISOString(),
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
      }
    }

    // 2. Generate Funder Settlement Advice (if invoice was funded)
    const { data: fundingOffers } = await supabase
      .from("funding_offers")
      .select("*")
      .eq("invoice_id", invoice.id)
      .eq("status", "accepted");

    if (fundingOffers && fundingOffers.length > 0) {
      for (const offer of fundingOffers) {
        const fundedDate = new Date(offer.accepted_at || offer.offered_at);
        const collectionDate = new Date(collection.collection_date);
        const daysFunded = Math.max(1, Math.ceil((collectionDate.getTime() - fundedDate.getTime()) / (1000 * 60 * 60 * 24)));

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

        // Get funder profile
        const { data: funderProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", offer.funder_user_id)
          .single();

        const funderAdvice = {
          organization_id: collection.organization_id,
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
          currency: collection.currency,
          fee_breakdown: funderReturn.feeBreakdown,
          payment_instructions: feeConfig.payment_instructions || {},
          status: "issued" as const,
          issued_at: new Date().toISOString(),
          metadata: {
            days_funded: daysFunded,
            discount_rate: effectiveFunderRate,
            rate_source: facilityRate?.final_discounting_rate ? "facility" : (offer.discount_rate ? "offer" : "product_fee_config"),
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

          // Create payment_instructions row for this settlement advice
          // Vybrel writes the instruction; PSP executes it.
          // Use upsert-like pattern: get or create PSP virtual accounts for payer/payee.
          const getOrCreatePspAccount = async (actorId: string, actorType: string) => {
            const { data: existing } = await supabase
              .from("psp_virtual_accounts")
              .select("id")
              .eq("actor_id", actorId)
              .eq("currency", collection.currency)
              .eq("organization_id", collection.organization_id)
              .maybeSingle();
            if (existing) return existing.id;
            const { data: created } = await supabase
              .from("psp_virtual_accounts")
              .insert({
                organization_id: collection.organization_id,
                actor_id: actorId,
                actor_type: actorType,
                currency: collection.currency,
                psp_provider: "manual",
              })
              .select("id")
              .single();
            return created?.id;
          };

          try {
            const [payerAccountId, payeeAccountId] = await Promise.all([
              getOrCreatePspAccount(collection.organization_id, "originator"),
              getOrCreatePspAccount(offer.funder_user_id, "funder"),
            ]);
            await supabase.from("payment_instructions").insert({
              organization_id: collection.organization_id,
              settlement_advice_id: fa.id,
              payer_psp_account_id: payerAccountId,
              payee_psp_account_id: payeeAccountId,
              amount: funderReturn.netReturn,
              currency: collection.currency,
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

    return new Response(
      JSON.stringify({
        success: true,
        advices_generated: advices.length,
        advices,
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
