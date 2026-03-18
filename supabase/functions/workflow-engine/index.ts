import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const authHeader = req.headers.get("authorization");
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, workflow_slug, table, event, record, status_field } = body;

    const adminClient = createClient(supabaseUrl, serviceKey);

    if (action === "evaluate") {
      // Find published workflow
      const { data: wf } = await adminClient
        .from("workflows")
        .select("id")
        .eq("slug", workflow_slug)
        .single();

      if (!wf) {
        return new Response(
          JSON.stringify({ allowed: true, actions: [], message: "No workflow found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: version } = await adminClient
        .from("workflow_versions")
        .select("nodes, edges, rules")
        .eq("workflow_id", wf.id)
        .eq("status", "published")
        .single();

      if (!version) {
        return new Response(
          JSON.stringify({ allowed: true, actions: [], message: "No published version" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rules = (version.rules as any[]) || [];

      // Find matching rules
      const matchingRules = rules.filter((r: any) => {
        if (r.trigger.table !== table) return false;
        if (r.trigger.event !== event) return false;
        if (event === "STATUS_CHANGE" && status_field && r.trigger.field !== status_field)
          return false;
        return true;
      });

      // Evaluate conditions
      const triggeredActions: any[] = [];
      for (const rule of matchingRules) {
        const conditionsMet = (rule.conditions || []).every((cond: any) => {
          const val = record?.[cond.field];
          switch (cond.operator) {
            case "eq": return val === cond.value;
            case "neq": return val !== cond.value;
            case "gt": return Number(val) > Number(cond.value);
            case "lt": return Number(val) < Number(cond.value);
            case "gte": return Number(val) >= Number(cond.value);
            case "lte": return Number(val) <= Number(cond.value);
            default: return true;
          }
        });

        if (conditionsMet) {
          triggeredActions.push(...(rule.actions || []));
        }
      }

      // Execute actions
      for (const act of triggeredActions) {
        if (act.type === "transition_status" && record?.id && table) {
          await adminClient
            .from(table)
            .update({ status: act.config.to })
            .eq("id", record.id);
        }
        if (act.type === "set_field" && record?.id && table) {
          await adminClient
            .from(table)
            .update({ [act.config.field]: act.config.value })
            .eq("id", record.id);
        }
        // For call_edge_function, we'd invoke another function
        if (act.type === "call_edge_function") {
          try {
            await fetch(`${supabaseUrl}/functions/v1/${act.config.function}`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ record, triggered_by: "workflow_engine" }),
            });
          } catch (e) {
            console.error("Failed to call edge function:", e);
          }
        }
      }

      return new Response(
        JSON.stringify({
          allowed: true,
          actions_executed: triggeredActions.length,
          actions: triggeredActions,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: check_transition
    if (action === "check_transition") {
      const { from_status, to_status } = body;

      const { data: wf } = await adminClient
        .from("workflows")
        .select("id")
        .eq("slug", workflow_slug)
        .single();

      if (!wf) {
        return new Response(
          JSON.stringify({ allowed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: version } = await adminClient
        .from("workflow_versions")
        .select("nodes, edges")
        .eq("workflow_id", wf.id)
        .eq("status", "published")
        .single();

      if (!version) {
        return new Response(
          JSON.stringify({ allowed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const nodes = (version.nodes as any[]) || [];
      const edges = (version.edges as any[]) || [];

      const fromNode = nodes.find(
        (n: any) => n.type === "status" && n.data?.statusValue === from_status
      );

      if (!fromNode) {
        return new Response(
          JSON.stringify({ allowed: true, reason: "Source status not in workflow" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // BFS to find if to_status is reachable from from_status
      const visited = new Set<string>();
      const queue = [fromNode.id];
      let found = false;

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const node = nodes.find((n: any) => n.id === current);
        if (node?.type === "status" && node.data?.statusValue === to_status && current !== fromNode.id) {
          found = true;
          break;
        }

        const outEdges = edges.filter((e: any) => e.source === current);
        for (const e of outEdges) {
          if (!visited.has(e.target)) queue.push(e.target);
        }
      }

      return new Response(
        JSON.stringify({ allowed: found }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
