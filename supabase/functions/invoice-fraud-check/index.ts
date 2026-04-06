import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface FraudCheckRequest {
  invoice_id?: string;
  organization_id: string;
  invoice_data: {
    invoice_number: string;
    debtor_name: string;
    amount: number;
    issue_date: string;
    due_date: string;
    currency?: string;
    borrower_id: string;
  };
  checked_by?: string;
}

interface DuplicateMatch {
  invoice_id: string;
  invoice_number: string;
  debtor_name: string;
  amount: number;
  match_type: "exact_number" | "fuzzy_amount_date" | "cross_borrower";
  similarity_score: number;
}

interface RuleResult {
  rule: string;
  triggered: boolean;
  score: number;
  reason: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: FraudCheckRequest = await req.json();
    const { organization_id, invoice_data, checked_by } = body;

    if (!organization_id || !invoice_data?.invoice_number || !invoice_data?.debtor_name || !invoice_data?.amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get org fraud threshold
    const { data: orgSettings } = await supabase
      .from("organization_settings")
      .select("fraud_threshold")
      .eq("organization_id", organization_id)
      .single();

    const threshold = orgSettings?.fraud_threshold ?? 70;

    // ---- 1. DUPLICATE DETECTION ----
    const duplicateMatches: DuplicateMatch[] = [];
    let duplicateScore = 0;

    // Exact invoice_number + debtor match
    const { data: exactDupes } = await supabase
      .from("invoices")
      .select("id, invoice_number, debtor_name, amount, issue_date")
      .eq("organization_id", organization_id)
      .eq("invoice_number", invoice_data.invoice_number)
      .eq("debtor_name", invoice_data.debtor_name);

    const filteredExact = (exactDupes || []).filter((d: any) =>
      !body.invoice_id || d.id !== body.invoice_id
    );

    for (const d of filteredExact) {
      duplicateMatches.push({
        invoice_id: d.id,
        invoice_number: d.invoice_number,
        debtor_name: d.debtor_name,
        amount: d.amount,
        match_type: "exact_number",
        similarity_score: 95,
      });
      duplicateScore = Math.max(duplicateScore, 90);
    }

    // Same invoice_number across different borrowers
    if (duplicateMatches.length === 0) {
      const { data: crossBorrower } = await supabase
        .from("invoices")
        .select("id, invoice_number, debtor_name, amount, borrower_id")
        .eq("organization_id", organization_id)
        .eq("invoice_number", invoice_data.invoice_number)
        .neq("borrower_id", invoice_data.borrower_id);

      for (const d of crossBorrower || []) {
        if (body.invoice_id && d.id === body.invoice_id) continue;
        duplicateMatches.push({
          invoice_id: d.id,
          invoice_number: d.invoice_number,
          debtor_name: d.debtor_name,
          amount: d.amount,
          match_type: "cross_borrower",
          similarity_score: 80,
        });
        duplicateScore = Math.max(duplicateScore, 75);
      }
    }

    // Fuzzy match: same debtor + amount ±5% + date within 7 days
    if (duplicateMatches.length === 0) {
      const amountLow = invoice_data.amount * 0.95;
      const amountHigh = invoice_data.amount * 1.05;
      const issueDate = new Date(invoice_data.issue_date);
      const dateLow = new Date(issueDate);
      dateLow.setDate(dateLow.getDate() - 7);
      const dateHigh = new Date(issueDate);
      dateHigh.setDate(dateHigh.getDate() + 7);

      const { data: fuzzyDupes } = await supabase
        .from("invoices")
        .select("id, invoice_number, debtor_name, amount, issue_date")
        .eq("organization_id", organization_id)
        .eq("debtor_name", invoice_data.debtor_name)
        .gte("amount", amountLow)
        .lte("amount", amountHigh)
        .gte("issue_date", dateLow.toISOString().split("T")[0])
        .lte("issue_date", dateHigh.toISOString().split("T")[0]);

      for (const d of fuzzyDupes || []) {
        if (body.invoice_id && d.id === body.invoice_id) continue;
        const amountDiff = Math.abs(d.amount - invoice_data.amount) / invoice_data.amount;
        const similarity = Math.round((1 - amountDiff) * 100);
        duplicateMatches.push({
          invoice_id: d.id,
          invoice_number: d.invoice_number,
          debtor_name: d.debtor_name,
          amount: d.amount,
          match_type: "fuzzy_amount_date",
          similarity_score: similarity,
        });
        duplicateScore = Math.max(duplicateScore, 55);
      }
    }

    // ---- 2. RULE-BASED CHECKS ----
    const ruleResults: RuleResult[] = [];

    // Rule: Amount vs historical average
    const { data: historicalInvs } = await supabase
      .from("invoices")
      .select("amount")
      .eq("organization_id", organization_id)
      .eq("borrower_id", invoice_data.borrower_id)
      .neq("status", "rejected");

    if (historicalInvs && historicalInvs.length >= 3) {
      const avg = historicalInvs.reduce((s: number, i: any) => s + Number(i.amount), 0) / historicalInvs.length;
      const isSpike = invoice_data.amount > avg * 3;
      ruleResults.push({
        rule: "amount_spike",
        triggered: isSpike,
        score: isSpike ? 20 : 0,
        reason: isSpike
          ? `Amount ${invoice_data.amount.toLocaleString()} is ${(invoice_data.amount / avg).toFixed(1)}x the historical average (${avg.toLocaleString()})`
          : "Amount within normal range",
      });
    }

    // Rule: Rapid successive invoices (>5 from same debtor in 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentFromDebtor, count: recentCount } = await supabase
      .from("invoices")
      .select("id", { count: "exact" })
      .eq("organization_id", organization_id)
      .eq("debtor_name", invoice_data.debtor_name)
      .gte("created_at", sevenDaysAgo.toISOString());

    const rapidFire = (recentCount || 0) > 5;
    ruleResults.push({
      rule: "rapid_succession",
      triggered: rapidFire,
      score: rapidFire ? 15 : 0,
      reason: rapidFire
        ? `${recentCount} invoices from ${invoice_data.debtor_name} in the last 7 days`
        : "Normal submission frequency",
    });

    // Rule: Supplier concentration
    const { data: allBorrowerInvs } = await supabase
      .from("invoices")
      .select("debtor_name, amount")
      .eq("organization_id", organization_id)
      .eq("borrower_id", invoice_data.borrower_id);

    if (allBorrowerInvs && allBorrowerInvs.length > 5) {
      const totalVal = allBorrowerInvs.reduce((s: number, i: any) => s + Number(i.amount), 0);
      const debtorVal = allBorrowerInvs
        .filter((i: any) => i.debtor_name === invoice_data.debtor_name)
        .reduce((s: number, i: any) => s + Number(i.amount), 0);
      const concentration = totalVal > 0 ? debtorVal / totalVal : 0;
      const isConcentrated = concentration > 0.8;
      ruleResults.push({
        rule: "supplier_concentration",
        triggered: isConcentrated,
        score: isConcentrated ? 10 : 0,
        reason: isConcentrated
          ? `${(concentration * 100).toFixed(0)}% of total invoice value is from ${invoice_data.debtor_name}`
          : "Healthy debtor diversification",
      });
    }

    // Rule: Round-number amount
    const isRound = invoice_data.amount >= 1000 && invoice_data.amount % 1000 === 0;
    ruleResults.push({
      rule: "round_number",
      triggered: isRound,
      score: isRound ? 5 : 0,
      reason: isRound ? "Exact round-number amount" : "Non-round amount",
    });

    // Rule: Weekend-dated invoice
    const invoiceDay = new Date(invoice_data.issue_date).getDay();
    const isWeekend = invoiceDay === 0 || invoiceDay === 6;
    ruleResults.push({
      rule: "weekend_date",
      triggered: isWeekend,
      score: isWeekend ? 5 : 0,
      reason: isWeekend ? "Invoice dated on a weekend" : "Normal business day",
    });

    // ---- 3. EXTERNAL API CHECKS (if configured) ----
    const externalResults: Record<string, any> = {};
    const { data: fraudProviders } = await supabase
      .from("registry_api_configs")
      .select("*")
      .eq("is_active", true)
      .contains("capabilities", ["fraud_detection"]);

    for (const provider of fraudProviders || []) {
      try {
        const apiKey = provider.api_key_value;
        if (!apiKey || !provider.api_base_url) continue;

        const res = await fetch(`${provider.api_base_url}/check`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            invoice_number: invoice_data.invoice_number,
            debtor_name: invoice_data.debtor_name,
            amount: invoice_data.amount,
            currency: invoice_data.currency || "USD",
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          externalResults[provider.registry_name] = await res.json();
        } else {
          externalResults[provider.registry_name] = { error: `HTTP ${res.status}`, skipped: true };
        }
      } catch (err: any) {
        externalResults[provider.registry_name] = { error: err.message, skipped: true };
      }
    }

    // ---- 4. SCORE AGGREGATION ----
    const ruleScore = ruleResults.reduce((s, r) => s + r.score, 0);
    const externalScore = Object.values(externalResults).reduce((s: number, r: any) => {
      if (r.fraud_score && typeof r.fraud_score === "number") return s + Math.min(r.fraud_score, 30);
      return s;
    }, 0);

    const rawScore = duplicateScore + ruleScore + externalScore;
    const finalScore = Math.min(rawScore, 100);

    const status: "passed" | "flagged" | "blocked" =
      finalScore >= threshold ? "blocked" :
      finalScore >= 40 ? "flagged" :
      "passed";

    // Build reasons array
    const reasons: string[] = [];
    if (duplicateMatches.length > 0) {
      reasons.push(`Duplicate detected: ${duplicateMatches.map(d => `${d.invoice_number} (${d.match_type})`).join(", ")}`);
    }
    for (const r of ruleResults) {
      if (r.triggered) reasons.push(r.reason);
    }
    for (const [name, result] of Object.entries(externalResults)) {
      if (result && !result.skipped && result.message) {
        reasons.push(`${name}: ${result.message}`);
      }
    }

    // ---- 5. PERSIST ----
    const checkRecord = {
      invoice_id: body.invoice_id || null,
      organization_id,
      fraud_score: finalScore,
      status,
      duplicate_matches: duplicateMatches,
      rule_results: ruleResults,
      ai_signals: {},
      external_results: externalResults,
      reasons,
      checked_by: checked_by || null,
    };

    // If invoice_id exists, persist to DB
    if (body.invoice_id) {
      await supabase.from("invoice_fraud_checks").insert(checkRecord);

      await supabase
        .from("invoices")
        .update({ fraud_score: finalScore, fraud_status: status })
        .eq("id", body.invoice_id);
    }

    // ---- 6. AUDIT LOG ----
    await supabase.from("audit_logs").insert({
      user_id: checked_by || null,
      action: "fraud_check",
      resource_type: "invoice",
      resource_id: body.invoice_id || null,
      details: {
        score: finalScore,
        status,
        reasons,
        duplicate_count: duplicateMatches.length,
        rules_triggered: ruleResults.filter(r => r.triggered).length,
      },
    });

    const result = {
      score: finalScore,
      status,
      reasons,
      duplicate_matches: duplicateMatches,
      rule_results: ruleResults,
      external_results: externalResults,
      threshold,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
