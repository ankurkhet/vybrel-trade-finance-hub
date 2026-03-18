import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";
import { WorkflowList } from "@/components/workflow/WorkflowList";
import { WorkflowVersionHistory } from "@/components/workflow/WorkflowVersionHistory";
import { WorkflowRulesEditor } from "@/components/workflow/WorkflowRulesEditor";
import { WORKFLOW_TEMPLATES } from "@/lib/workflow-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Upload,
  Plus,
  Workflow,
  GitBranch,
  Zap,
  History,
} from "lucide-react";
import type { Node, Edge } from "@xyflow/react";
import type { WorkflowRule } from "@/lib/workflow-templates";

export default function WorkflowStudio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [localNodes, setLocalNodes] = useState<Node[]>([]);
  const [localEdges, setLocalEdges] = useState<Edge[]>([]);
  const [localRules, setLocalRules] = useState<WorkflowRule[]>([]);
  const [activeTab, setActiveTab] = useState("canvas");

  // Fetch selected workflow's active version
  const { data: activeVersion } = useQuery({
    queryKey: ["workflow-version-detail", activeVersionId],
    queryFn: async () => {
      if (!activeVersionId) return null;
      const { data, error } = await supabase
        .from("workflow_versions")
        .select("*")
        .eq("id", activeVersionId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!activeVersionId,
  });

  // Fetch workflow detail
  const { data: selectedWorkflow } = useQuery({
    queryKey: ["workflow-detail", selectedWorkflowId],
    queryFn: async () => {
      if (!selectedWorkflowId) return null;
      const { data, error } = await supabase
        .from("workflows")
        .select("*, workflow_versions(*)")
        .eq("id", selectedWorkflowId)
        .single();
      if (error) throw error;

      // Auto-select draft or published version
      const versions = (data as any).workflow_versions || [];
      const draft = versions.find((v: any) => v.status === "draft");
      const published = versions.find((v: any) => v.status === "published");
      const version = draft || published || versions[0];
      if (version) {
        setActiveVersionId(version.id);
        setLocalNodes(Array.isArray(version.nodes) ? version.nodes : []);
        setLocalEdges(Array.isArray(version.edges) ? version.edges : []);
        setLocalRules(Array.isArray(version.rules) ? version.rules : []);
      }
      return data;
    },
    enabled: !!selectedWorkflowId,
  });

  // Initialize template
  const initTemplateMutation = useMutation({
    mutationFn: async (slug: string) => {
      const template = WORKFLOW_TEMPLATES.find((t) => t.slug === slug);
      if (!template) throw new Error("Template not found");

      const { data: wf, error: wfError } = await supabase
        .from("workflows")
        .insert({
          name: template.name,
          slug: template.slug,
          description: template.description,
          category: template.category,
          is_system: true,
          created_by: user?.id,
        })
        .select()
        .single();
      if (wfError) throw wfError;

      const { error: vError } = await supabase
        .from("workflow_versions")
        .insert({
          workflow_id: wf.id,
          version_number: 1,
          version_label: "Initial template",
          status: "published",
          nodes: template.nodes as any,
          edges: template.edges as any,
          rules: template.rules as any,
          published_at: new Date().toISOString(),
          published_by: user?.id,
          created_by: user?.id,
        });
      if (vError) throw vError;

      return wf;
    },
    onSuccess: (wf) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setSelectedWorkflowId(wf.id);
      toast.success("Workflow initialized from template");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  // Create custom workflow
  const createWorkflowMutation = useMutation({
    mutationFn: async () => {
      const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const { data: wf, error: wfError } = await supabase
        .from("workflows")
        .insert({
          name: newName,
          slug,
          description: newDescription,
          category: "custom",
          is_system: false,
          created_by: user?.id,
        })
        .select()
        .single();
      if (wfError) throw wfError;

      const { error: vError } = await supabase
        .from("workflow_versions")
        .insert({
          workflow_id: wf.id,
          version_number: 1,
          version_label: "Initial draft",
          status: "draft",
          nodes: [] as any,
          edges: [] as any,
          rules: [] as any,
          created_by: user?.id,
        });
      if (vError) throw vError;

      return wf;
    },
    onSuccess: (wf) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setSelectedWorkflowId(wf.id);
      setShowNewDialog(false);
      setNewName("");
      setNewDescription("");
      toast.success("Workflow created");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  // Save draft
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!activeVersionId) throw new Error("No active version");

      // If current version is published, create new draft version
      if (activeVersion?.status === "published") {
        const versions = (selectedWorkflow as any)?.workflow_versions || [];
        const nextNum = Math.max(...versions.map((v: any) => v.version_number), 0) + 1;
        const { data, error } = await supabase
          .from("workflow_versions")
          .insert({
            workflow_id: selectedWorkflowId!,
            version_number: nextNum,
            version_label: `Draft v${nextNum}`,
            status: "draft",
            nodes: localNodes as any,
            edges: localEdges as any,
            rules: localRules as any,
            created_by: user?.id,
          })
          .select()
          .single();
        if (error) throw error;
        setActiveVersionId(data.id);
        return data;
      }

      // Update existing draft
      const { error } = await supabase
        .from("workflow_versions")
        .update({
          nodes: localNodes as any,
          edges: localEdges as any,
          rules: localRules as any,
        })
        .eq("id", activeVersionId);
      if (error) throw error;
    },
    onSuccess: () => {
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["workflow-versions"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-detail"] });
      toast.success("Draft saved");
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  // Publish
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!activeVersionId || !selectedWorkflowId) throw new Error("No version");

      // Save first if dirty
      if (isDirty) {
        await saveMutation.mutateAsync();
      }

      // Archive current published
      await supabase
        .from("workflow_versions")
        .update({ status: "archived" })
        .eq("workflow_id", selectedWorkflowId)
        .eq("status", "published");

      // Publish
      const { error } = await supabase
        .from("workflow_versions")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          published_by: user?.id,
        })
        .eq("id", activeVersionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflow-versions"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-detail"] });
      queryClient.invalidateQueries({ queryKey: ["published-workflows"] });
      toast.success("Workflow published! Changes are now live across the platform.");
    },
    onError: (err) => toast.error(`Publish failed: ${err.message}`),
  });

  const handleCanvasSave = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      setLocalNodes(nodes);
      setLocalEdges(edges);
      setIsDirty(true);
      saveMutation.mutate();
    },
    [saveMutation]
  );

  const handleRulesChange = useCallback((rules: WorkflowRule[]) => {
    setLocalRules(rules);
    setIsDirty(true);
  }, []);

  // List view
  if (!selectedWorkflowId) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Workflow className="h-6 w-6 text-primary" />
                Workflow Studio
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Design, version, and publish workflows that control how Vybrel operates
              </p>
            </div>
            <Button onClick={() => setShowNewDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Workflow
            </Button>
          </div>

          <WorkflowList
            onSelect={setSelectedWorkflowId}
            onCreateNew={() => setShowNewDialog(true)}
            onInitTemplate={(slug) => initTemplateMutation.mutate(slug)}
          />

          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Custom Workflow</DialogTitle>
                <DialogDescription>
                  Define a new workflow to automate platform processes
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Custom Approval Flow"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe what this workflow controls..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => createWorkflowMutation.mutate()}
                  disabled={!newName || createWorkflowMutation.isPending}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  // Editor view
  const isPublished = activeVersion?.status === "published";

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedWorkflowId(null);
                setActiveVersionId(null);
                setIsDirty(false);
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {(selectedWorkflow as any)?.name || "Loading..."}
                </h2>
                {isPublished && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px]">
                    Live
                  </Badge>
                )}
                {activeVersion?.status === "draft" && (
                  <Badge variant="outline" className="text-[10px]">Draft</Badge>
                )}
                {isDirty && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">
                    Unsaved
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                v{activeVersion?.version_number || "?"} · {activeVersion?.version_label || ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!isDirty || saveMutation.isPending}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save
            </Button>
            <Button
              size="sm"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Publish
            </Button>
          </div>
        </div>

        {/* Tabbed content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 mt-3">
          <TabsList className="shrink-0">
            <TabsTrigger value="canvas" className="gap-1.5">
              <GitBranch className="h-3.5 w-3.5" />
              Canvas
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="canvas" className="flex-1 min-h-0 mt-3 border rounded-lg overflow-hidden">
            <WorkflowCanvas
              initialNodes={localNodes}
              initialEdges={localEdges}
              onSave={handleCanvasSave}
              isDirty={isDirty}
            />
          </TabsContent>

          <TabsContent value="rules" className="flex-1 overflow-y-auto mt-3">
            <WorkflowRulesEditor
              rules={localRules}
              onChange={handleRulesChange}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            {selectedWorkflowId && (
              <WorkflowVersionHistory
                workflowId={selectedWorkflowId}
                currentVersionId={activeVersionId || undefined}
                onPublish={(vId) => {
                  setActiveVersionId(vId);
                  publishMutation.mutate();
                }}
                onRestore={(vId) => setActiveVersionId(vId)}
                onPreview={(vId) => setActiveVersionId(vId)}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
