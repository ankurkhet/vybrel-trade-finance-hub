import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WorkflowRule } from "@/lib/workflow-templates";

/**
 * Hook that fetches the published workflow rules for a given workflow slug.
 * Components use this to dynamically check allowed transitions, auto-actions, etc.
 */
export function useWorkflowEngine(workflowSlug: string) {
  const { data, isLoading } = useQuery({
    queryKey: ["published-workflows", workflowSlug],
    queryFn: async () => {
      // Find the workflow
      const { data: wf, error: wfError } = await supabase
        .from("workflows")
        .select("id")
        .eq("slug", workflowSlug)
        .single();

      if (wfError || !wf) return null;

      // Get published version
      const { data: version, error: vError } = await supabase
        .from("workflow_versions")
        .select("nodes, edges, rules")
        .eq("workflow_id", wf.id)
        .eq("status", "published")
        .single();

      if (vError || !version) return null;
      return version;
    },
    staleTime: 30_000, // Cache for 30s
  });

  const rules: WorkflowRule[] = (data?.rules as any) || [];
  const nodes = (data?.nodes as any[]) || [];
  const edges = (data?.edges as any[]) || [];

  /**
   * Get allowed status transitions from current status
   */
  const getAllowedTransitions = (currentStatus: string): string[] => {
    const statusNodes = nodes.filter((n: any) => n.type === "status");
    const currentNode = statusNodes.find(
      (n: any) => n.data?.statusValue === currentStatus
    );
    if (!currentNode) return [];

    // Find edges from this node
    const outgoing = edges.filter((e: any) => e.source === currentNode.id);
    const targetIds = outgoing.map((e: any) => e.target);

    // Resolve target nodes - could be conditions or statuses
    const targets: string[] = [];
    for (const targetId of targetIds) {
      const targetNode = nodes.find((n: any) => n.id === targetId);
      if (!targetNode) continue;

      if (targetNode.type === "status") {
        targets.push(targetNode.data?.statusValue);
      } else if (targetNode.type === "condition") {
        // Follow condition outputs to find eventual status nodes
        const condOutEdges = edges.filter((e: any) => e.source === targetId);
        for (const ce of condOutEdges) {
          const cn = nodes.find((n: any) => n.id === ce.target);
          if (cn?.type === "status") targets.push(cn.data?.statusValue);
          if (cn?.type === "action") {
            // Follow action to next status
            const actionOut = edges.filter((e: any) => e.source === cn.id);
            for (const ae of actionOut) {
              const an = nodes.find((n: any) => n.id === ae.target);
              if (an?.type === "status") targets.push(an.data?.statusValue);
            }
          }
        }
      }
    }

    return [...new Set(targets.filter(Boolean))];
  };

  /**
   * Check if a transition is allowed
   */
  const isTransitionAllowed = (from: string, to: string): boolean => {
    const allowed = getAllowedTransitions(from);
    return allowed.includes(to);
  };

  /**
   * Get rules that trigger on a specific event
   */
  const getRulesForEvent = (
    table: string,
    event: "INSERT" | "UPDATE" | "STATUS_CHANGE",
    statusField?: string
  ): WorkflowRule[] => {
    return rules.filter((r) => {
      if (r.trigger.table !== table) return false;
      if (r.trigger.event !== event) return false;
      if (event === "STATUS_CHANGE" && statusField && r.trigger.field !== statusField)
        return false;
      return true;
    });
  };

  /**
   * Evaluate conditions against a record
   */
  const evaluateConditions = (
    conditions: WorkflowRule["conditions"],
    record: Record<string, unknown>
  ): boolean => {
    return conditions.every((cond) => {
      const fieldValue = record[cond.field];
      switch (cond.operator) {
        case "eq": return fieldValue === cond.value;
        case "neq": return fieldValue !== cond.value;
        case "gt": return Number(fieldValue) > Number(cond.value);
        case "lt": return Number(fieldValue) < Number(cond.value);
        case "gte": return Number(fieldValue) >= Number(cond.value);
        case "lte": return Number(fieldValue) <= Number(cond.value);
        case "in": return Array.isArray(cond.value) && cond.value.includes(fieldValue);
        case "contains": return String(fieldValue).includes(String(cond.value));
        default: return true;
      }
    });
  };

  return {
    isLoading,
    nodes,
    edges,
    rules,
    getAllowedTransitions,
    isTransitionAllowed,
    getRulesForEvent,
    evaluateConditions,
    hasWorkflow: !!data,
  };
}
