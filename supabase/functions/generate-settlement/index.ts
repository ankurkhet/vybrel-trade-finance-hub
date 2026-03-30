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

function calculateSettlement(
  grossAmount: number,
  feeConfig: FeeConfig,
  productType: string,
  discountRate?: number
) {
  const effectiveDiscount = discountRate ?? feeConfig.default_discount_rate;

  // Product-specific settlement logic
  let originatorFeePct = feeConfig.originator_fee_pct;
  let platformFeePct = feeConfig.platform_fee_pct;

  switch (productType) {
    case "receivables_purchase":
      // Standard: discount applied at funding, originator fee on collection
      break;
    case "reverse_factoring":
      // Lower originator fee (buyer-initiated, lower risk)
      originatorFeePct = Math.max(originatorFeePct * 0.75, 0);
      break;
    case "payables_finance":
      // Higher platform fee for payables finance
      platformFeePct = platformFeePct * 1.25;
      break;
  }

  const discountAmount = (grossAmount * effectiveDiscount) / 100;
  const originatorFee = (grossAmount * originatorFeePct) / 100;
  const platformFee = (grossAmount * platformFeePct) / 100;
  const totalDeductions = discountAmount + originatorFee + platformFee;
  const netAmount = grossAmount - totalDeductions;

  const feeBreakdown = [
    { label: "Gross Collection", amount: grossAmount, type: "gross" },
    { label: `Discount (${effectiveDiscount}%)`, amount: -discountAmount, type: "discount" },
    { label: `Originator Fee (${originatorFeePct}%)`, amount: -originatorFee, type: "fee" },
    { label: `Platform Fee (${platformFeePct}%)`, amount: -platformFee, type: "fee" },
    { label: "Net Settlement", amount: netAmount, type: "net" },
  ];

  return {
    discountAmount,
    originatorFee,
    platformFee,
    netAmount,
    feeBreakdown,
  };
}

function calculateFunderReturn(
  fundedAmount: number,
  discountRate: number,
  daysFunded: number,
  feeConfig: FeeConfig
) {
  // Funder yield = funded amount * discount rate * days / 365
  const annualizedYield = (fundedAmount * discountRate * daysFunded) / (100 * 365);
  const platformFee = (annualizedYield * feeConfig.platform_fee_pct) / 100;
  const netReturn = fundedAmount + annualizedYield - platformFee;

  const feeBreakdown = [
    { label: "Funded Amount (Principal)", amount: fundedAmount, type: "gross" },
    { label: `Yield (${discountRate}% p.a. × ${daysFunded} days)`, amount: annualizedYield, type: "yield" },
    { label: `Platform Fee (${feeConfig.platform_fee_pct}%)`, amount: -platformFee, type: "fee" },
    { label: "Net Settlement", amount: netReturn, type: "net" },
  ];

  return {
    yield: annualizedYield,
    platformFee,
    netReturn,
    feeBreakdown,
  };
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

    // Fetch organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", collection.organization_id)
      .single();

    const orgName = org?.name || "Originator";

    // Fetch product fee config
    const { data: feeConfigData } = await supabase
      .from("product_fee_configs")
      .select("*")
      .eq("organization_id", collection.organization_id)
      .eq("product_type", invoice.product_type || "receivables_purchase")
      .single();

    const feeConfig: FeeConfig = feeConfigData || DEFAULT_FEE_CONFIG;
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
        invoice.product_type || "receivables_purchase"
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
        // Calculate days funded
        const fundedDate = new Date(offer.accepted_at || offer.offered_at);
        const collectionDate = new Date(collection.collection_date);
        const daysFunded = Math.max(1, Math.ceil((collectionDate.getTime() - fundedDate.getTime()) / (1000 * 60 * 60 * 24)));

        const funderReturn = calculateFunderReturn(
          offer.offer_amount,
          offer.discount_rate || feeConfig.default_discount_rate,
          daysFunded,
          feeConfig
        );

        // Get funder profile
        const { data: funderProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", offer.funder_user_id)
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
            discount_rate: offer.discount_rate || feeConfig.default_discount_rate,
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
