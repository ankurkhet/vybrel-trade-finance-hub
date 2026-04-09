import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, UserMinus, UserCheck } from "lucide-react";
import { toast } from "sonner";

export function CreditCommitteeSettings() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const [addEmail, setAddEmail] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["cc-config", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_committee_config")
        .select("*")
        .eq("organization_id", orgId!)
        .maybeSingle();
      return data || { organization_id: orgId, total_active_members: 4, minimum_votes_required: 3, quorum_type: "fixed" };
    },
    enabled: !!orgId,
  });

  const [totalMembers, setTotalMembers] = useState<number | null>(null);
  const [minVotes, setMinVotes] = useState<number | null>(null);
  const [quorumType, setQuorumType] = useState<string | null>(null);

  const effectiveTotal = totalMembers ?? config?.total_active_members ?? 4;
  const effectiveMin = minVotes ?? config?.minimum_votes_required ?? 3;
  const effectiveQuorum = quorumType ?? config?.quorum_type ?? "fixed";

  // Members
  const { data: members = [] } = useQuery({
    queryKey: ["cc-members", orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from("credit_committee_members")
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!orgId,
  });

  // Profile lookup for display
  const { data: memberProfiles = [] } = useQuery({
    queryKey: ["cc-member-profiles", members.map((m: any) => m.user_id)],
    queryFn: async () => {
      if (members.length === 0) return [];
      const userIds = members.map((m: any) => m.user_id);
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      return data || [];
    },
    enabled: members.length > 0,
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        organization_id: orgId!,
        total_active_members: effectiveTotal,
        minimum_votes_required: effectiveMin,
        quorum_type: effectiveQuorum,
        updated_by: user!.id,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("credit_committee_config").upsert(payload, { onConflict: "organization_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuration saved");
      queryClient.invalidateQueries({ queryKey: ["cc-config"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMemberMutation = useMutation({
    mutationFn: async () => {
      // Look up user by email
      const { data: prof } = await supabase.from("profiles").select("id").eq("email", addEmail).maybeSingle();
      if (!prof) throw new Error("No user found with that email in this organization");

      // Add as member
      const { error } = await supabase.from("credit_committee_members").insert({
        organization_id: orgId!,
        user_id: prof.id,
      });
      if (error) throw error;

      // Also assign the role
      await supabase.from("user_roles").insert({ user_id: prof.id, role: "credit_committee_member" as any });
    },
    onSuccess: () => {
      toast.success("Member added");
      setAddEmail("");
      setAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cc-members"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMemberMutation = useMutation({
    mutationFn: async ({ memberId, isActive }: { memberId: string; isActive: boolean }) => {
      await supabase.from("credit_committee_members").update({ is_active: isActive }).eq("id", memberId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cc-members"] });
      toast.success("Member updated");
    },
  });

  const getProfile = (userId: string) => memberProfiles.find((p: any) => p.id === userId);

  return (
    <div className="space-y-6">
      {/* Quorum Configuration */}
      <Card>
        <CardHeader><CardTitle className="text-base">Quorum Rules</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Total Active Members</Label>
              <Input type="number" min={1} value={effectiveTotal} onChange={(e) => setTotalMembers(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Minimum Votes Required</Label>
              <Input type="number" min={1} max={effectiveTotal} value={effectiveMin} onChange={(e) => setMinVotes(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Quorum Type</Label>
              <Select value={effectiveQuorum} onValueChange={(v) => setQuorumType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed (e.g. 3 of 5)</SelectItem>
                  <SelectItem value="majority">Simple Majority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Committee Members</CardTitle>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add Member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Committee Member</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>User Email</Label>
                  <Input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="user@example.com" />
                </div>
                <Button className="w-full" disabled={!addEmail || addMemberMutation.isPending} onClick={() => addMemberMutation.mutate()}>
                  {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No committee members configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => {
                  const prof = getProfile(m.user_id);
                  return (
                    <TableRow key={m.id}>
                      <TableCell>{prof?.full_name || "Unknown"}</TableCell>
                      <TableCell className="text-muted-foreground">{prof?.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={m.is_active ? "default" : "secondary"}>
                          {m.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={m.is_active}
                          onCheckedChange={(checked) => toggleMemberMutation.mutate({ memberId: m.id, isActive: checked })}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
