import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Plus, Search, Mail, Clock, CheckCircle2, RotateCcw,
  UserCog, Building2, Landmark, Handshake, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type PrimaryRole = "originator_admin" | "originator_user" | "account_manager" | "operations_manager" | "credit_committee_member" | "funder" | "broker_admin" | "borrower";

const INTERNAL_ROLES: { value: PrimaryRole; label: string }[] = [
  { value: "originator_admin", label: "Originator Admin" },
  { value: "originator_user", label: "Originator User" },
  { value: "account_manager", label: "Account Manager" },
  { value: "operations_manager", label: "Operations Manager" },
  { value: "credit_committee_member", label: "Credit Committee Member" },
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
  account_manager: "Account Manager",
  operations_manager: "Operations Manager",
  credit_committee_member: "Credit Committee Member",
  funder: "Funder / Lender",
  broker_admin: "Broker",
  borrower: "Borrower",
  credit_manager: "Credit Manager",
  relationship_manager: "Relationship Manager",
  legal: "Legal",
};

// ─── Invite Dialog ────────────────────────────────────────────────────────────
function InviteDialog({ open, onClose, orgId, userId, onDone }: any) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [role, setRole] = useState<PrimaryRole>("originator_admin");
  const [subRoles, setSubRoles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleSubRole = (r: string) => {
    setSubRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const handleInvite = async () => {
    if (!email) { toast.error("Email is required"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("invitations").insert({
      organization_id: orgId,
      email,
      role: role as any,
      invited_by: userId,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(`Invitation sent to ${email}`);
      onDone();
      onClose();
      setEmail(""); setFullName(""); setRole("originator_admin"); setSubRoles([]); setIsInternal(true);
    }
    setSubmitting(false);
  };

  const currentRoles = isInternal ? INTERNAL_ROLES : EXTERNAL_ROLES;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Invite User</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch id="internal" checked={isInternal} onCheckedChange={v => { setIsInternal(v); setRole(v ? "originator_admin" : "funder"); setSubRoles([]); }} />
            <Label htmlFor="internal" className="text-sm">{isInternal ? "Internal team member" : "External party (funder / broker / borrower)"}</Label>
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Role *</Label>
            <Select value={role} onValueChange={v => setRole(v as PrimaryRole)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {currentRoles.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isInternal && role === "originator_user" && (
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Additional permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {ORIGINATOR_USER_SUB_ROLES.map(sr => (
                  <div key={sr.value} className="flex items-center gap-2">
                    <Checkbox id={sr.value} checked={subRoles.includes(sr.value)} onCheckedChange={() => toggleSubRole(sr.value)} />
                    <Label htmlFor={sr.value} className="text-xs">{sr.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleInvite} disabled={submitting || !email}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invitations table (internal + external) ─────────────────────────────────
function InvitationsTab({ roleFilter, orgId, userId }: { roleFilter?: string[]; orgId: string; userId: string }) {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const fetchInvitations = async () => {
    setLoading(true);
    let q = supabase.from("invitations").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
    if (roleFilter && roleFilter.length > 0) q = q.in("role", roleFilter as any[]);
    const { data } = await q;
    setInvitations(data || []);
    setLoading(false);
  };

  useEffect(() => { if (orgId) fetchInvitations(); }, [orgId]);

  const handleResend = async (inv: any) => {
    const { error } = await supabase.from("invitations").update({
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      resent_count: (inv.resent_count || 0) + 1,
      last_resent_at: new Date().toISOString(),
    }).eq("id", inv.id);
    if (error) toast.error(error.message);
    else { toast.success(`Invitation resent to ${inv.email}`); fetchInvitations(); }
  };

  const filtered = invitations.filter(i =>
    i.email.toLowerCase().includes(search.toLowerCase()) ||
    (ROLE_LABELS[i.role] || i.role).toLowerCase().includes(search.toLowerCase())
  );

  const isExpired = (inv: any) => !inv.accepted_at && inv.expires_at && new Date(inv.expires_at) < new Date();
  const isPending = (inv: any) => !inv.accepted_at && !isExpired(inv);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by email or role..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}><Plus className="h-4 w-4 mr-1" />Invite</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invitations found</TableCell></TableRow>
            )}
            {filtered.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="text-sm">{inv.email}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{ROLE_LABELS[inv.role] || inv.role}</Badge></TableCell>
                <TableCell>
                  {inv.accepted_at ? (
                    <Badge variant="default" className="gap-1 text-xs"><CheckCircle2 className="h-3 w-3" />Accepted</Badge>
                  ) : isExpired(inv) ? (
                    <Badge variant="destructive" className="text-xs">Expired</Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-xs"><Clock className="h-3 w-3" />Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "—"}
                  {inv.resent_count > 0 && <span className="text-[10px] ml-1">(resent {inv.resent_count}×)</span>}
                </TableCell>
                <TableCell>
                  {!inv.accepted_at && (
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleResend(inv)}>
                      <RotateCcw className="h-3 w-3" />Resend
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} orgId={orgId} userId={userId} onDone={fetchInvitations} />
    </div>
  );
}

// ─── Active profiles tab ──────────────────────────────────────────────────────
function ProfilesTab({ orgId }: { orgId: string }) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchProfiles = () => {
    if (!orgId) return;
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, full_name, email, created_at, user_roles(role)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setProfiles(data || []); setLoading(false); });
  };

  useEffect(() => {
    fetchProfiles();
    const channel = supabase
      .channel("profiles-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `organization_id=eq.${orgId}` }, fetchProfiles)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, fetchProfiles)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId]);

  const filtered = profiles.filter(p =>
    (p.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.email || "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No active users</TableCell></TableRow>
          )}
          {filtered.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium text-sm">{p.full_name || "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(p.user_roles || []).map((ur: any) => (
                    <Badge key={ur.role} variant="secondary" className="text-[10px]">{ROLE_LABELS[ur.role] || ur.role}</Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { profile, user } = useAuth();
  const orgId = profile?.organization_id || "";
  const userId = user?.id || "";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage all users across your originator platform — internal team, borrowers, funders, and brokers.</p>
        </div>

        <Tabs defaultValue="internal">
          <TabsList>
            <TabsTrigger value="internal" className="gap-1.5"><UserCog className="h-3.5 w-3.5" />Internal</TabsTrigger>
            <TabsTrigger value="borrowers" className="gap-1.5"><Building2 className="h-3.5 w-3.5" />Borrowers</TabsTrigger>
            <TabsTrigger value="funders" className="gap-1.5"><Landmark className="h-3.5 w-3.5" />Funders</TabsTrigger>
            <TabsTrigger value="brokers" className="gap-1.5"><Handshake className="h-3.5 w-3.5" />Brokers</TabsTrigger>
            <TabsTrigger value="all" className="gap-1.5"><Users className="h-3.5 w-3.5" />All Active</TabsTrigger>
          </TabsList>

          <TabsContent value="internal" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <p className="text-xs text-muted-foreground">Internal team — admins, account managers, operations, credit committee.</p>
              </CardHeader>
              <CardContent>
                <InvitationsTab roleFilter={["originator_admin", "originator_user"]} orgId={orgId} userId={userId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="borrowers" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <InvitationsTab roleFilter={["borrower"]} orgId={orgId} userId={userId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="funders" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <InvitationsTab roleFilter={["funder"]} orgId={orgId} userId={userId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="brokers" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <InvitationsTab roleFilter={["broker_admin"]} orgId={orgId} userId={userId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all" className="mt-4">
            <Card>
              <CardContent className="pt-6">
                <ProfilesTab orgId={orgId} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
