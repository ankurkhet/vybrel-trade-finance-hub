import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { action, application_id, organization_id } = body;

    if (action === "check_quorum") {
      // Get config
      const { data: config } = await adminClient
        .from("credit_committee_config")
        .select("*")
        .eq("organization_id", organization_id)
        .maybeSingle();

      // Read exclusively from structured credit_committee_votes table (single source of truth)
      const { data: structuredVotes } = await adminClient
        .from("credit_committee_votes")
        .select("*")
        .eq("application_id", application_id);

      const votesArr = (structuredVotes || []).map((v: any) => ({
        user_id: v.user_id,
        vote: v.vote,
        conditions: v.conditions_text,
        product_limits: v.product_limits,
        voted_at: v.voted_at,
      }));

      const approves = votesArr.filter((v: any) => v.vote === "approve" || v.vote === "approve_with_conditions").length;
      const rejects = votesArr.filter((v: any) => v.vote === "reject").length;

      const needed = config?.quorum_type === "majority"
        ? Math.ceil((config?.total_active_members || 4) / 2)
        : config?.minimum_votes_required || 3;

      let decision = null;
      if (approves >= needed) decision = "approved";
      else if (rejects >= needed) decision = "rejected";

      if (decision) {
        // Update application status
        await adminClient.from("credit_committee_applications").update({
          status: decision,
          decision,
          reviewed_at: new Date().toISOString(),
        }).eq("id", application_id);

        // Get application details
        const { data: app } = await adminClient
          .from("credit_committee_applications")
          .select("application_number, type, debtor_name, borrower_id, metadata, credit_memo_id")
          .eq("id", application_id)
          .single();

        // Auto-generate minutes text
        const minutesText = `Credit Committee Decision - ${app?.application_number}\n` +
          `Type: ${app?.type}\nSubject: ${app?.debtor_name || "N/A"}\n` +
          `Decision: ${decision.toUpperCase()}\n` +
          `Votes: ${approves} approve, ${rejects} reject out of ${votesArr.length} total\n` +
          `Quorum required: ${needed}\n` +
          `Date: ${new Date().toISOString()}`;

        // Update or create minutes
        const { data: existingMinutes } = await adminClient
          .from("credit_committee_minutes")
          .select("id")
          .eq("application_id", application_id)
          .limit(1);

        if (existingMinutes && existingMinutes.length > 0) {
          await adminClient.from("credit_committee_minutes").update({
            minutes_text: minutesText,
          }).eq("application_id", application_id);
        }

        // Auto-create credit_limit_recommendation on approval
        if (decision === "approved" && app?.borrower_id) {
          const meta = app.metadata || {};
          const approvedLimits = meta.approved_limits || {};

          await adminClient.from("credit_limit_recommendations").insert({
            application_id,
            borrower_id: app.borrower_id,
            organization_id,
            recommended_overall_limit: meta.proposed_limit || 0,
            currency: meta.currency || "GBP",
            limit_receivables_purchase: approvedLimits.receivables_purchase || 0,
            limit_reverse_factoring: approvedLimits.reverse_factoring || 0,
            limit_payables_finance: approvedLimits.payable_finance || 0,
            counterparty_limits: meta.counterparty_limits || [],
            risk_grade: meta.risk_grade || null,
            recommended_rate: meta.recommended_rate || null,
            valid_from: new Date().toISOString().split("T")[0],
            valid_to: null,
            status: "active",
            created_by: userId,
          });
        }
      }

      return new Response(JSON.stringify({
        quorum_met: !!decision,
        decision,
        approves,
        rejects,
        total_votes: votesArr.length,
        needed,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
