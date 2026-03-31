import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const APPLICATION_TYPES = [
  { value: "new_client", label: "New Client" },
  { value: "client_review", label: "Client Review" },
  { value: "debtor_limit", label: "Debtor Limit" },
  { value: "portfolio_review", label: "Portfolio Review" },
  { value: "funder_facility", label: "Funder Facility" },
  { value: "work_out", label: "Work Out" },
  { value: "write_off", label: "Write Off" },
];

const STATUS_FILTERS = ["all", "draft", "submitted", "under_review", "pending_info", "approved", "rejected", "reopened"];

export function CreditCommitteeApplications() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formType, setFormType] = useState("");
  const [formDebtor, setFormDebtor] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["cc-applications", profile?.organization_id, statusFilter],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      let q = supabase
        .from("credit_committee_applications")
        .select("*, borrowers(company_name)")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const appNum = `CC-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("credit_committee_applications").insert({
        organization_id: profile!.organization_id!,
        type: formType,
        debtor_name: formDebtor || null,
        application_number: appNum,
        status: "draft",
        created_by: user!.id,
        decision_notes: formNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application created");
      setDialogOpen(false);
      setFormType("");
      setFormDebtor("");
      setFormNotes("");
      queryClient.invalidateQueries({ queryKey: ["cc-applications"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Applications</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>{s === "all" ? "All Status" : s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> New</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Credit Committee Application</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Application Type</Label>
                  <Select value={formType} onValueChange={setFormType}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {APPLICATION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Debtor / Subject Name</Label>
                  <Input value={formDebtor} onChange={(e) => setFormDebtor(e.target.value)} placeholder="e.g. Acme Corp" />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Additional context..." />
                </div>
                <Button className="w-full" disabled={!formType || createMutation.isPending} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? "Creating..." : "Create Application"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applications found.</p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application #</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Debtor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app: any) => (
                  <TableRow key={app.id} className="cursor-pointer" onClick={() => navigate(`/originator/credit-committee/applications/${app.id}`)}>
                    <TableCell className="font-mono text-xs">{app.application_number}</TableCell>
                    <TableCell className="capitalize">{(app.type || "").replace("_", " ")}</TableCell>
                    <TableCell>{app.debtor_name || "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(app.status) as any}>{app.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(app.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
