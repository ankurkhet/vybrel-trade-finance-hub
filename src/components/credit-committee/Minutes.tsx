import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

export function CreditCommitteeMinutes() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: minutes = [], isLoading } = useQuery({
    queryKey: ["cc-all-minutes", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      // Get all applications for this org first
      const { data: apps } = await supabase
        .from("credit_committee_applications")
        .select("id, application_number, type, status")
        .eq("organization_id", profile.organization_id);
      if (!apps || apps.length === 0) return [];

      const appIds = apps.map((a: any) => a.id);
      const { data: mins } = await supabase
        .from("credit_committee_minutes")
        .select("*")
        .in("application_id", appIds)
        .order("created_at", { ascending: false });

      return (mins || []).map((m: any) => ({
        ...m,
        application: apps.find((a: any) => a.id === m.application_id),
      }));
    },
    enabled: !!profile?.organization_id,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Committee Minutes</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : minutes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No minutes recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Meeting Date</TableHead>
                <TableHead>Votes</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {minutes.map((m: any) => {
                const votes = Array.isArray(m.votes) ? m.votes : [];
                const approves = votes.filter((v: any) => v.vote === "approve" || v.vote === "approve_with_conditions").length;
                const rejects = votes.filter((v: any) => v.vote === "reject").length;

                return (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/originator/credit-committee/applications/${m.application_id}`)}
                  >
                    <TableCell className="font-mono text-xs">{m.application?.application_number || "—"}</TableCell>
                    <TableCell className="capitalize">{(m.application?.type || "").replace("_", " ")}</TableCell>
                    <TableCell className="text-xs">{m.meeting_date ? new Date(m.meeting_date).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <span className="text-emerald-600">{approves}✓</span>
                      {" / "}
                      <span className="text-destructive">{rejects}✗</span>
                      {" / "}
                      <span className="text-muted-foreground">{votes.length} total</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.application?.status === "approved" ? "default" : m.application?.status === "rejected" ? "destructive" : "secondary"}>
                        {m.application?.status || "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
