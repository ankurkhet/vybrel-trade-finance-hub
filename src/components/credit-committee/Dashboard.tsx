import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCheck, Clock, XCircle, RotateCcw, AlertCircle } from "lucide-react";

export function CreditCommitteeDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: applications = [] } = useQuery({
    queryKey: ["cc-applications-summary", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from("credit_committee_applications")
        .select("id, status, type, created_at")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  const stats = {
    pending: applications.filter((a: any) => ["submitted", "under_review"].includes(a.status)).length,
    pendingInfo: applications.filter((a: any) => a.status === "pending_info").length,
    approved: applications.filter((a: any) => a.status === "approved").length,
    rejected: applications.filter((a: any) => a.status === "rejected").length,
    reopened: applications.filter((a: any) => a.status === "reopened").length,
  };

  const statCards = [
    { label: "Pending Review", value: stats.pending, icon: Clock, color: "text-amber-500" },
    { label: "Awaiting Info", value: stats.pendingInfo, icon: AlertCircle, color: "text-blue-500" },
    { label: "Approved", value: stats.approved, icon: FileCheck, color: "text-emerald-500" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-destructive" },
    { label: "Reopened", value: stats.reopened, icon: RotateCcw, color: "text-purple-500" },
  ];

  const recentApps = applications.slice(0, 8);

  const typeLabels: Record<string, string> = {
    new_client: "New Client",
    client_review: "Client Review",
    debtor_limit: "Debtor Limit",
    portfolio_review: "Portfolio Review",
    funder_facility: "Funder Facility",
    work_out: "Work Out",
    write_off: "Write Off",
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "approved": return "default";
      case "rejected": return "destructive";
      case "pending_info": return "secondary";
      case "reopened": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {recentApps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            <div className="space-y-3">
              {recentApps.map((app: any) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/originator/credit-committee/applications/${app.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{typeLabels[app.type] || app.type}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant={statusVariant(app.status) as any}>{app.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
