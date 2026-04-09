import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, Loader2, Mail, Clock, CheckCircle2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type PrimaryRole = "originator_admin" | "originator_user" | "funder" | "broker_admin" | "borrower";

const INTERNAL_ROLES: { value: PrimaryRole; label: string }[] = [
  { value: "originator_admin", label: "Originator Admin" },
  { value: "originator_user", label: "Originator User" },
];

const EXTERNAL_ROLES: { value: PrimaryRole; label: string }[] = [
  { value: "funder", label: "Funder / Lender" },
  { value: "broker_admin", label: "Broker" },
  { value: "borrower", label: "Borrower" },
];

const ORIGINATOR_USER_SUB_ROLES = [
  { value: "credit_committee_member", label: "Credit Committee Member" },
  { value: "credit_manager", label: "Credit Manager" },
  { value: "operations_manager", label: "Operations Manager" },
  { value: "relationship_manager", label: "Relationship Manager" },
  { value: "legal", label: "Legal" },
];

const ROLE_LABELS: Record<string, string> = {
  originator_admin: "Originator Admin",
  originator_user: "Originator User",
  funder: "Funder / Lender",
  broker_admin: "Broker",
  borrower: "Borrower",
  credit_committee_member: "Credit Committee",
  credit_manager: "Credit Manager",
  operations_manager: "Operations Manager",
  relationship_manager: "Relationship Manager",
  legal: "Legal",
};

export default function InviteUsers() {
  const { profile, user } = useAuth();
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [role, setRole] = useState<PrimaryRole>("originator_admin");
  const [subRoles, setSubRoles] = useState<string[]>([]);

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
      role: role as any,
      invited_by: user?.id,
    });

    if (error) {
      toast.error(error.message);
    } else {
      // If originator_user with sub-roles, store them in metadata (future use)
      toast.success(`Invitation sent to ${email}`);
      setDialogOpen(false);
      setEmail("");
      setFullName("");
      setRole("originator_admin");
      setSubRoles([]);
      setIsInternal(true);
      fetchInvitations();
    }
    setSubmitting(false);
  };

  const toggleSubRole = (r: string) => {
    setSubRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const handleResendInvite = async (inv: any) => {
    const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("invitations").update({
      expires_at: newExpiry,
      resent_count: (inv.resent_count || 0) + 1,
      last_resent_at: new Date().toISOString(),
    }).eq("id", inv.id);

    if (error) {
      toast.error("Failed to resend invitation: " + error.message);
    } else {
      toast.success(`Invitation resent to ${inv.email} — expires in 7 days`);
      fetchInvitations();
    }
  };

  const roleColor = (r: string) => {
    switch (r) {
      case "originator_admin": return "default";
      case "originator_user": return "secondary";
      case "funder": return "default";
      case "broker_admin": return "secondary";
      case "borrower": return "outline";
      default: return "outline";
    }
  };

  const currentRoles = isInternal ? INTERNAL_ROLES : EXTERNAL_ROLES;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Invite Users</h1>
            <p className="text-sm text-muted-foreground">Invite staff, funders, brokers, and borrowers to the platform</p>
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
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium text-foreground">{inv.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleColor(inv.role) as any} className="capitalize text-xs">
                          {ROLE_LABELS[inv.role] || inv.role.replace(/_/g, " ")}
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
                      <TableCell className="text-right">
                        {!inv.accepted_at && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResendInvite(inv)}
                            title={inv.resent_count ? `Resend (sent ${inv.resent_count}x already)` : "Resend invitation"}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Resend
                            {inv.resent_count > 0 && <span className="ml-1 text-[10px] text-muted-foreground">×{inv.resent_count}</span>}
                          </Button>
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
        <DialogContent className="sm:max-w-md">
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

            {/* Internal / External toggle */}
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Label className="text-sm font-medium flex-1">User Type</Label>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${!isInternal ? "text-muted-foreground" : "font-medium text-foreground"}`}>Internal</span>
                <Switch checked={!isInternal} onCheckedChange={(v) => {
                  setIsInternal(!v);
                  setRole(!v ? "originator_admin" : "funder");
                  setSubRoles([]);
                }} />
                <span className={`text-xs ${isInternal ? "text-muted-foreground" : "font-medium text-foreground"}`}>External</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={role} onValueChange={(v) => { setRole(v as PrimaryRole); setSubRoles([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currentRoles.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sub-roles for Originator User */}
            {role === "originator_user" && (
              <div className="space-y-2">
                <Label className="text-sm">Assign Function Roles</Label>
                <p className="text-xs text-muted-foreground">Select one or more functional roles for this user</p>
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {ORIGINATOR_USER_SUB_ROLES.map(sr => (
                    <div key={sr.value} className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <Checkbox
                        id={sr.value}
                        checked={subRoles.includes(sr.value)}
                        onCheckedChange={() => toggleSubRole(sr.value)}
                      />
                      <Label htmlFor={sr.value} className="text-sm font-normal cursor-pointer">{sr.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
