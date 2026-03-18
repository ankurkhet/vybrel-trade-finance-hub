import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  Archive,
  RotateCcw,
  Upload,
  Eye,
  GitCompare,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { WorkflowCanvas } from "./WorkflowCanvas";

interface WorkflowVersionHistoryProps {
  workflowId: string;
  currentVersionId?: string;
  onPublish: (versionId: string) => void;
  onRestore: (versionId: string) => void;
  onPreview: (versionId: string) => void;
}

export function WorkflowVersionHistory({
  workflowId,
  currentVersionId,
  onPublish,
  onRestore,
  onPreview,
}: WorkflowVersionHistoryProps) {
  const queryClient = useQueryClient();
  const [diffVersions, setDiffVersions] = useState<[string, string] | null>(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: ["workflow-versions", workflowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_versions")
        .select("*")
        .eq("workflow_id", workflowId)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (versionId: string) => {
      // Archive current published version
      await supabase
        .from("workflow_versions")
        .update({ status: "archived" })
        .eq("workflow_id", workflowId)
        .eq("status", "published");

      // Publish selected version
      const { error } = await supabase
        .from("workflow_versions")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", versionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-versions", workflowId] });
      toast.success("Version published successfully! Changes are now live.");
    },
    onError: () => toast.error("Failed to publish version"),
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const version = versions?.find((v: any) => v.id === versionId);
      if (!version) throw new Error("Version not found");

      const nextVersion = Math.max(...(versions?.map((v: any) => v.version_number) || [0])) + 1;

      const { error } = await supabase.from("workflow_versions").insert({
        workflow_id: workflowId,
        version_number: nextVersion,
        version_label: `Restored from v${version.version_number}`,
        status: "draft",
        nodes: version.nodes,
        edges: version.edges,
        rules: version.rules,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-versions", workflowId] });
      toast.success("Version restored as new draft");
    },
    onError: () => toast.error("Failed to restore version"),
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "published": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "draft": return <Clock className="h-3.5 w-3.5 text-amber-500" />;
      default: return <Archive className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "published": return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">Live</Badge>;
      case "draft": return <Badge variant="outline" className="text-[10px]">Draft</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">Archived</Badge>;
    }
  };

  // Diff: compare node counts between two versions
  const getDiffSummary = (v1: any, v2: any) => {
    const n1 = Array.isArray(v1.nodes) ? v1.nodes.length : 0;
    const n2 = Array.isArray(v2.nodes) ? v2.nodes.length : 0;
    const e1 = Array.isArray(v1.edges) ? v1.edges.length : 0;
    const e2 = Array.isArray(v2.edges) ? v2.edges.length : 0;
    const r1 = Array.isArray(v1.rules) ? v1.rules.length : 0;
    const r2 = Array.isArray(v2.rules) ? v2.rules.length : 0;
    return {
      nodes: { before: n1, after: n2, diff: n2 - n1 },
      edges: { before: e1, after: e2, diff: e2 - e1 },
      rules: { before: r1, after: r2, diff: r2 - r1 },
    };
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Version History</h3>
        {versions && versions.length >= 2 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs">
                <GitCompare className="h-3 w-3 mr-1" />
                Compare
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Compare Versions</DialogTitle>
                <DialogDescription>Select two versions to compare changes</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                {["From", "To"].map((label, idx) => (
                  <div key={label}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
                    <div className="space-y-1">
                      {versions?.map((v: any) => (
                        <Button
                          key={v.id}
                          variant={diffVersions?.[idx] === v.id ? "default" : "outline"}
                          size="sm"
                          className="w-full justify-start text-xs"
                          onClick={() => {
                            setDiffVersions((prev) => {
                              const next = [...(prev || ["", ""])] as [string, string];
                              next[idx] = v.id;
                              return next;
                            });
                          }}
                        >
                          v{v.version_number} {v.version_label && `— ${v.version_label}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {diffVersions?.[0] && diffVersions?.[1] && (() => {
                const v1 = versions?.find((v: any) => v.id === diffVersions[0]);
                const v2 = versions?.find((v: any) => v.id === diffVersions[1]);
                if (!v1 || !v2) return null;
                const diff = getDiffSummary(v1, v2);
                return (
                  <div className="mt-4 rounded-lg border bg-muted/30 p-4 space-y-2">
                    <p className="text-sm font-medium">Changes Summary</p>
                    {(["nodes", "edges", "rules"] as const).map((key) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{key}</span>
                        <span>
                          {diff[key].before} → {diff[key].after}{" "}
                          <span className={diff[key].diff > 0 ? "text-emerald-500" : diff[key].diff < 0 ? "text-red-500" : "text-muted-foreground"}>
                            ({diff[key].diff > 0 ? "+" : ""}{diff[key].diff})
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2 pr-3">
          {versions?.map((v: any) => (
            <div
              key={v.id}
              className={`rounded-lg border p-3 transition-colors ${
                v.id === currentVersionId ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {statusIcon(v.status)}
                  <span className="text-sm font-medium">v{v.version_number}</span>
                  {statusBadge(v.status)}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(v.created_at), "MMM d, yyyy HH:mm")}
                </span>
              </div>
              {v.version_label && (
                <p className="text-xs text-muted-foreground mb-2">{v.version_label}</p>
              )}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onPreview(v.id)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                {v.status === "draft" && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => publishMutation.mutate(v.id)}
                    disabled={publishMutation.isPending}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Publish
                  </Button>
                )}
                {v.status === "archived" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => restoreMutation.mutate(v.id)}
                    disabled={restoreMutation.isPending}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restore
                  </Button>
                )}
                {v.status === "published" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-red-600"
                    onClick={() => {
                      // Revoke = archive current published, restore previous
                      const prevPublished = versions?.find(
                        (pv: any) => pv.status === "archived" && pv.version_number === v.version_number - 1
                      );
                      if (prevPublished) {
                        publishMutation.mutate(prevPublished.id);
                      } else {
                        toast.error("No previous version to revert to");
                      }
                    }}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
