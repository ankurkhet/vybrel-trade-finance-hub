import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, AlertCircle, Clock } from "lucide-react";

interface ChangeTrackerProps {
  borrowerId: string;
}

interface AuditEntry {
  id: string;
  action: string;
  created_at: string;
  user_email: string | null;
  details: any;
}

export function ChangeTracker({ borrowerId }: ChangeTrackerProps) {
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("resource_type", "borrower")
      .eq("resource_id", borrowerId)
      .order("created_at", { ascending: false })
      .limit(50);
    setHistory(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, [borrowerId]);

  // Find recent changes (last 7 days)
  const recentChanges = history.filter(h => {
    const d = new Date(h.created_at);
    const now = new Date();
    return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  });

  const hasRecentUpdates = recentChanges.some(h =>
    h.action === "borrower_onboarding_submitted" ||
    h.action === "borrower_profile_updated" ||
    h.action === "borrower_status_changed"
  );

  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      borrower_onboarding_submitted: "Application Submitted",
      borrower_status_changed: "Status Changed",
      borrower_update_requested: "Update Requested",
      borrower_profile_updated: "Profile Updated",
      facility_approved: "Facility Approved",
      facility_rejected: "Facility Rejected",
    };
    return map[action] || action.replace(/_/g, " ");
  };

  const formatDetails = (details: any) => {
    if (!details) return "—";
    if (details.from && details.to) return `${details.from.replace(/_/g, " ")} → ${details.to.replace(/_/g, " ")}`;
    if (details.section) return `Section: ${details.section.replace(/_/g, " ")}`;
    if (details.company_name) return details.company_name;
    return JSON.stringify(details).slice(0, 100);
  };

  return (
    <>
      {/* Inline alert for recent changes */}
      {hasRecentUpdates && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertCircle className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Recent Changes Detected</p>
              <p className="text-xs text-muted-foreground">
                {recentChanges.length} update(s) in the last 7 days
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="mr-2 h-4 w-4" /> View History
            </Button>
          </CardContent>
        </Card>
      )}

      {!hasRecentUpdates && (
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
          <History className="mr-2 h-4 w-4" /> View History
        </Button>
      )}

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Profile Change History
            </DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No history entries found.</p>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{formatAction(entry.action)}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{formatDetails(entry.details)}</p>
                    {entry.user_email && (
                      <p className="text-xs text-muted-foreground">by {entry.user_email}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
