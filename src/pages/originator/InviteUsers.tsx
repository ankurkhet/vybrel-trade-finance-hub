import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, Loader2, Mail, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type InviteRole = "funder" | "broker_admin" | "borrower";

const ROLE_LABELS: Record<InviteRole, string> = {
  funder: "Funder / Lender",
  broker_admin: "Broker",
  borrower: "Borrower",
};

export default function InviteUsers() {
  const { profile, user } = useAuth();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<InviteRole>("funder");

  const orgId = profile?.organization_id;

  useEffect(() => {
    if (orgId) fetchInvitations();
  }, [orgId]);

  const fetchInvitations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invitations")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setInvitations(data || []);
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!email) { toast.error("Email is required"); return; }
    setSubmitting(true);

    const { error } = await supabase.from("invitations").insert({
      organization_id: orgId,
      email,
      role,
      invited_by: user?.id,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Invitation sent to ${email}`);
      setDialogOpen(false);
      setEmail("");
      setFullName("");
      setRole("funder");
      fetchInvitations();
    }
    setSubmitting(false);
  };

  const roleColor = (r: string) => {
    switch (r) {
      case "funder": return "default";
      case "broker_admin": return "secondary";
      case "borrower": return "outline";
      default: return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Invite Users</h1>
            <p className="text-sm text-muted-foreground">Invite funders, brokers, and borrowers to the platform</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Send Invitation
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Invited", value: invitations.length, icon: Mail },
            { label: "Pending", value: invitations.filter((i) => !i.accepted_at).length, icon: Clock },
            { label: "Accepted", value: invitations.filter((i) => i.accepted_at).length, icon: CheckCircle2 },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <s.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invitation History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : invitations.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <UserPlus className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No invitations sent yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium text-foreground">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleColor(inv.role) as any} className="capitalize text-xs">
                          {ROLE_LABELS[inv.role as InviteRole] || inv.role.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(inv.expires_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {inv.accepted_at ? (
                          <Badge variant="default" className="text-xs"><CheckCircle2 className="mr-1 h-3 w-3" /> Accepted</Badge>
                        ) : new Date(inv.expires_at) < new Date() ? (
                          <Badge variant="destructive" className="text-xs">Expired</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Invitation</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Smith" />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="funder">Funder / Lender</SelectItem>
                  <SelectItem value="broker_admin">Broker</SelectItem>
                  <SelectItem value="borrower">Borrower</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
