import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WORKFLOW_TEMPLATES } from "@/lib/workflow-templates";
import {
  FileText,
  Users,
  Gavel,
  Receipt,
  Plus,
  ArrowRight,
  Workflow,
} from "lucide-react";

const categoryIcons: Record<string, typeof FileText> = {
  invoices: FileText,
  borrowers: Users,
  credit_committee: Gavel,
  settlements: Receipt,
  custom: Workflow,
};

interface WorkflowListProps {
  onSelect: (workflowId: string) => void;
  onCreateNew: () => void;
  onInitTemplate: (slug: string) => void;
}

export function WorkflowList({ onSelect, onCreateNew, onInitTemplate }: WorkflowListProps) {
  const { data: workflows, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflows")
        .select("*, workflow_versions(id, version_number, status, published_at, created_at)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const existingSlugs = new Set(workflows?.map((w: any) => w.slug) || []);
  const missingTemplates = WORKFLOW_TEMPLATES.filter(
    (t) => !existingSlugs.has(t.slug)
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3 mt-2" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Existing workflows */}
      {workflows && workflows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Active Workflows
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workflows.map((wf: any) => {
              const Icon = categoryIcons[wf.category] || Workflow;
              const publishedVersion = wf.workflow_versions?.find(
                (v: any) => v.status === "published"
              );
              const draftVersion = wf.workflow_versions?.find(
                (v: any) => v.status === "draft"
              );
              return (
                <Card
                  key={wf.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors group"
                  onClick={() => onSelect(wf.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <CardTitle className="text-base">{wf.name}</CardTitle>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {wf.description}
                    </p>
                    <div className="flex items-center gap-2">
                      {publishedVersion && (
                        <Badge variant="default" className="text-[10px]">
                          v{publishedVersion.version_number} Live
                        </Badge>
                      )}
                      {draftVersion && (
                        <Badge variant="outline" className="text-[10px]">
                          v{draftVersion.version_number} Draft
                        </Badge>
                      )}
                      {wf.is_system && (
                        <Badge variant="secondary" className="text-[10px]">System</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Template blueprints to initialize */}
      {missingTemplates.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Available Templates
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {missingTemplates.map((tpl) => {
              const Icon = categoryIcons[tpl.category] || Workflow;
              return (
                <Card key={tpl.slug} className="border-dashed">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base text-muted-foreground">{tpl.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {tpl.description}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInitTemplate(tpl.slug);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Initialize
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Create custom */}
      <Card className="border-dashed cursor-pointer hover:border-primary/50 transition-colors" onClick={onCreateNew}>
        <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Plus className="h-5 w-5" />
          <span className="font-medium">Create Custom Workflow</span>
        </CardContent>
      </Card>
    </div>
  );
}
