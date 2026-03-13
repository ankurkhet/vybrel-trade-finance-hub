import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plus, Users, Settings, Send, Loader2, Palette, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type LabellingMode = Database["public"]["Enums"]["labelling_mode"];

interface OrgWithSettings {
  id: string;
  name: string;
  slug: string;
  labelling_mode: LabellingMode;
  is_active: boolean;
  branding: any;
  created_at: string;
  custom_domain: string | null;
}

export default function Organizations() {
  const [orgs, setOrgs] = useState<OrgWithSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrgWithSettings | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newMode, setNewMode] = useState<LabellingMode>("platform_label");
  const [newPrimaryColor, setNewPrimaryColor] = useState("#1a1a2e");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newDefaultLimit, setNewDefaultLimit] = useState("");
  const [newMaxLimit, setNewMaxLimit] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOrgs(data);
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };

  const handleCreate = async () => {
    if (!newName || !newSlug) {
      toast.error("Name and slug are required");
      return;
    }
    setCreating(true);

    const branding = {
      primary_color: newPrimaryColor,
      logo_url: newLogoUrl || null,
    };

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: newName,
        slug: newSlug,
        labelling_mode: newMode,
        branding,
      })
      .select()
      .single();

    if (orgErr) {
      toast.error(orgErr.message);
      setCreating(false);
      return;
    }

    // Create org settings
    if (org) {
      await supabase.from("organization_settings" as any).insert({
        organization_id: org.id,
        default_credit_limit: parseFloat(newDefaultLimit) || 0,
        max_credit_limit: parseFloat(newMaxLimit) || 0,
        notes: newNotes || null,
      });
    }

    toast.success(`Organization "${newName}" created`);
    setCreateOpen(false);
    resetCreateForm();
    fetchOrgs();
    setCreating(false);
  };

  const resetCreateForm = () => {
    setNewName("");
    setNewSlug("");
    setNewMode("platform_label");
    setNewPrimaryColor("#1a1a2e");
    setNewLogoUrl("");
    setNewDefaultLimit("");
    setNewMaxLimit("");
    setNewNotes("");
  };

  const handleInvite = async () => {
    if (!inviteEmail || !selectedOrg) {
      toast.error("Email is required");
      return;
    }
    setInviting(true);

    const { data: session } = await supabase.auth.getSession();

    const { error } = await supabase.from("invitations").insert({
      email: inviteEmail,
      organization_id: selectedOrg.id,
      role: "originator_admin" as any,
      invited_by: session.session?.user?.id || null,
    });

    if (error) {
      toast.error(error.message);
    } else {
      // Get the invitation token to build the link
      const { data: inv } = await supabase
        .from("invitations")
        .select("token")
        .eq("email", inviteEmail)
        .eq("organization_id", selectedOrg.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const inviteUrl = `${window.location.origin}/invite/accept?token=${inv?.token}`;

      toast.success(
        <div className="space-y-1">
          <p>Invitation created for {inviteEmail}</p>
          <p className="text-xs text-muted-foreground">Share this link:</p>
          <code className="block text-xs bg-muted p-1 rounded break-all">{inviteUrl}</code>
        </div>,
        { duration: 15000 }
      );
    }

    setInviteEmail("");
    setInviting(false);
    setInviteOpen(false);
  };

  const labelModeDisplay = (mode: LabellingMode) => {
    switch (mode) {
      case "white_label": return "White Label";
      case "joint_label": return "Joint Label";
      case "platform_label": return "Platform Label";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
            <p className="text-sm text-muted-foreground">Manage originator organizations on the platform</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>Set up a new originator with branding and credit policies</DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="general" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="branding">Branding</TabsTrigger>
                  <TabsTrigger value="policies">Credit Policies</TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input
                      placeholder="Acme Trade Finance"
                      value={newName}
                      onChange={(e) => {
                        setNewName(e.target.value);
                        setNewSlug(generateSlug(e.target.value));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Slug (URL-friendly identifier)</Label>
                    <Input
                      placeholder="acme-trade-finance"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Labelling Mode</Label>
                    <Select value={newMode} onValueChange={(v) => setNewMode(v as LabellingMode)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="white_label">White Label — Originator's brand only</SelectItem>
                        <SelectItem value="joint_label">Joint Label — Co-branded with Vybrel</SelectItem>
                        <SelectItem value="platform_label">Platform Label — Vybrel branded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="branding" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Primary Color</Label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={newPrimaryColor}
                        onChange={(e) => setNewPrimaryColor(e.target.value)}
                        className="h-10 w-14 rounded border cursor-pointer"
                      />
                      <Input
                        value={newPrimaryColor}
                        onChange={(e) => setNewPrimaryColor(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Logo URL</Label>
                    <Input
                      placeholder="https://example.com/logo.png"
                      value={newLogoUrl}
                      onChange={(e) => setNewLogoUrl(e.target.value)}
                    />
                  </div>
                  {newLogoUrl && (
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-2">Preview</p>
                      <img src={newLogoUrl} alt="Logo preview" className="h-12 object-contain" />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="policies" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Default Credit Limit (USD)</Label>
                      <Input
                        type="number"
                        placeholder="100000"
                        value={newDefaultLimit}
                        onChange={(e) => setNewDefaultLimit(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Credit Limit (USD)</Label>
                      <Input
                        type="number"
                        placeholder="5000000"
                        value={newMaxLimit}
                        onChange={(e) => setNewMaxLimit(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Policy Notes</Label>
                    <Textarea
                      placeholder="Any specific credit policies, document requirements, or notes for this originator..."
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      rows={4}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Organization
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orgs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">No organizations yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first originator organization to get started</p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create Organization
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {orgs.map((org) => (
              <Card key={org.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: (org.branding as any)?.primary_color || "hsl(var(--primary))" }}
                    >
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-base">{org.name}</CardTitle>
                      <CardDescription className="text-xs">/{org.slug}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={org.is_active ? "default" : "secondary"}>
                      {org.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline">{labelModeDisplay(org.labelling_mode)}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedOrg(org);
                        setInviteOpen(true);
                      }}
                    >
                      <Send className="mr-2 h-3 w-3" />
                      Invite Admin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Invite Dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Originator Admin</DialogTitle>
              <DialogDescription>
                Send an invitation to manage <span className="font-medium">{selectedOrg?.name}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="admin@originator.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The invitee will receive a link to create their account with the <strong>originator_admin</strong> role, assigned to this organization.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={handleInvite} disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
