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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

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

      // Get minutes/votes
      const { data: minutes } = await adminClient
        .from("credit_committee_minutes")
        .select("votes")
        .eq("application_id", application_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const votes = minutes?.[0]?.votes || [];
      const votesArr = Array.isArray(votes) ? votes : [];
      const approves = votesArr.filter((v: any) => v.vote === "approve" || v.vote === "approve_with_conditions").length;
      const rejects = votesArr.filter((v: any) => v.vote === "reject").length;

      const needed = config?.quorum_type === "majority"
        ? Math.ceil((config?.total_active_members || 4) / 2)
        : config?.minimum_votes_required || 3;

      let decision = null;
      if (approves >= needed) decision = "approved";
      else if (rejects >= needed) decision = "rejected";

      if (decision) {
        await adminClient.from("credit_committee_applications").update({
          status: decision,
          decision,
          reviewed_at: new Date().toISOString(),
        }).eq("id", application_id);

        // Auto-generate minutes text
        const { data: app } = await adminClient
          .from("credit_committee_applications")
          .select("application_number, type, debtor_name")
          .eq("id", application_id)
          .single();

        const minutesText = `Credit Committee Decision - ${app?.application_number}\n` +
          `Type: ${app?.type}\nSubject: ${app?.debtor_name || "N/A"}\n` +
          `Decision: ${decision.toUpperCase()}\n` +
          `Votes: ${approves} approve, ${rejects} reject out of ${votesArr.length} total\n` +
          `Quorum required: ${needed}\n` +
          `Date: ${new Date().toISOString()}`;

        if (minutes?.[0]) {
          await adminClient.from("credit_committee_minutes").update({
            minutes_text: minutesText,
          }).eq("application_id", application_id);
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
