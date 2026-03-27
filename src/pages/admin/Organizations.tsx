import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plus, Loader2, UserPlus, Trash2, Upload, CheckCircle2, XCircle, Clock, FileText, Eye, Users, CreditCard, Landmark, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { OrgDetailPanel } from "@/components/admin/OrgDetailPanel";
import { formatCurrency, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/components/ui/currency-input";

type LabellingMode = Database["public"]["Enums"]["labelling_mode"];

interface ContactInput {
  full_name: string;
  email: string;
  designation: string;
  is_primary: boolean;
}

interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  onboarding_status: string;
  labelling_mode: LabellingMode;
  branding: any;
  borrowerCount: number;
  counterpartyCount: number;
  lenderCount: number;
  monthlyInvoicesByCurrency: Record<string, number>;
  outstandingByCurrency: Record<string, number>;
}

export default function Organizations() {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>("GBP");

  // Create form
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newMode, setNewMode] = useState<LabellingMode>("platform_label");
  const [newPrimaryColor, setNewPrimaryColor] = useState("#1a1a2e");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [contacts, setContacts] = useState<ContactInput[]>([
    { full_name: "", email: "", designation: "", is_primary: true },
  ]);
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchOrgs(); }, []);

  const fetchOrgs = async () => {
    setLoading(true);
    const { data: rawOrgs } = await supabase
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });

    if (!rawOrgs) { setLoading(false); return; }

    // Fetch summary data for each org
    const summaries: OrgSummary[] = [];
    for (const org of rawOrgs) {
      const [borrowersRes, counterpartiesRes, lendersRes, invoicesRes] = await Promise.all([
        supabase.from("borrowers").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
        supabase.from("counterparties").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
        supabase.from("borrower_lenders").select("id", { count: "exact", head: true }).eq("organization_id", org.id),
        supabase.from("invoices").select("amount, currency, status, created_at").eq("organization_id", org.id),
      ]);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyInvoicesByCurrency: Record<string, number> = {};
      const outstandingByCurrency: Record<string, number> = {};

      (invoicesRes.data || []).forEach((inv: any) => {
        const cur = inv.currency || "GBP";
        const amt = Number(inv.amount) || 0;
        const createdAt = new Date(inv.created_at);
        if (createdAt >= monthStart) {
          monthlyInvoicesByCurrency[cur] = (monthlyInvoicesByCurrency[cur] || 0) + amt;
        }
        if (inv.status !== "settled" && inv.status !== "rejected") {
          outstandingByCurrency[cur] = (outstandingByCurrency[cur] || 0) + amt;
        }
      });

      summaries.push({
        id: org.id,
        name: org.name,
        slug: org.slug,
        is_active: org.is_active,
        onboarding_status: org.onboarding_status,
        labelling_mode: org.labelling_mode,
        branding: org.branding,
        borrowerCount: borrowersRes.count || 0,
        counterpartyCount: counterpartiesRes.count || 0,
        lenderCount: lendersRes.count || 0,
        monthlyInvoicesByCurrency,
        outstandingByCurrency,
      });
    }

    setOrgs(summaries);
    setLoading(false);
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const addContact = () => {
    setContacts([...contacts, { full_name: "", email: "", designation: "", is_primary: false }]);
  };

  const removeContact = (idx: number) => {
    if (contacts.length <= 1) return;
    const updated = contacts.filter((_, i) => i !== idx);
    if (!updated.some((c) => c.is_primary)) updated[0].is_primary = true;
    setContacts(updated);
  };

  const updateContact = (idx: number, field: keyof ContactInput, value: string | boolean) => {
    const updated = [...contacts];
    if (field === "is_primary" && value === true) {
      updated.forEach((c) => (c.is_primary = false));
    }
    (updated[idx] as any)[field] = value;
    setContacts(updated);
  };

  const handleCreate = async () => {
    if (!newName || !newSlug) { toast.error("Name and slug are required"); return; }
    const validContacts = contacts.filter((c) => c.full_name && c.email && c.designation);
    if (validContacts.length === 0) { toast.error("At least one contact person is required"); return; }

    setCreating(true);

    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({
        name: newName,
        slug: newSlug,
        labelling_mode: newMode,
        branding: { primary_color: newPrimaryColor, logo_url: newLogoUrl || null },
        is_active: false,
      })
      .select()
      .single();

    if (orgErr || !org) { toast.error(orgErr?.message || "Failed to create org"); setCreating(false); return; }

    const contactRows = validContacts.map((c) => ({
      organization_id: org.id,
      full_name: c.full_name,
      email: c.email,
      designation: c.designation,
      is_primary: c.is_primary,
    }));
    await supabase.from("org_contacts" as any).insert(contactRows);

    const { data: session } = await supabase.auth.getSession();
    for (const contact of validContacts) {
      const { data: inv } = await supabase.from("invitations").insert({
        email: contact.email,
        organization_id: org.id,
        role: "originator_admin" as any,
        invited_by: session.session?.user?.id || null,
      }).select("token").single();

      await supabase.from("org_contacts" as any)
        .update({ invited_at: new Date().toISOString() })
        .eq("organization_id", org.id)
        .eq("email", contact.email);

      if (inv) {
        const inviteUrl = `${window.location.origin}/invite/accept?token=${inv.token}`;
        console.log(`Invitation for ${contact.email}: ${inviteUrl}`);
      }
    }

    toast.success(
      <div className="space-y-1">
        <p><strong>{newName}</strong> created successfully</p>
        <p className="text-xs text-muted-foreground">{validContacts.length} invitation(s) generated.</p>
      </div>,
      { duration: 8000 }
    );

    setCreateOpen(false);
    resetForm();
    fetchOrgs();
    setCreating(false);
  };

  const resetForm = () => {
    setNewName(""); setNewSlug(""); setNewMode("platform_label");
    setNewPrimaryColor("#1a1a2e"); setNewLogoUrl("");
    setContacts([{ full_name: "", email: "", designation: "", is_primary: true }]);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="bg-green-600">Approved</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      case "under_review": return <Badge className="bg-yellow-600">Under Review</Badge>;
      case "documents_submitted": return <Badge className="bg-blue-600">Docs Submitted</Badge>;
      default: return <Badge variant="secondary">Pending Documents</Badge>;
    }
  };

  const labelModeDisplay = (mode: LabellingMode) => {
    switch (mode) {
      case "white_label": return "White Label";
      case "joint_label": return "Joint Label";
      case "platform_label": return "Platform Label";
    }
  };

  const renderCurrencyBreakdown = (byCurrency: Record<string, number>) => {
    const entries = Object.entries(byCurrency);
    if (entries.length === 0) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="space-y-0.5">
        {entries.map(([cur, amt]) => (
          <p key={cur} className="text-xs">{formatCurrency(amt, cur as CurrencyCode)}</p>
        ))}
      </div>
    );
  };

  if (selectedOrgId) {
    return (
      <DashboardLayout>
        <OrgDetailPanel
          orgId={selectedOrgId}
          onBack={() => { setSelectedOrgId(null); fetchOrgs(); }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Originator Organizations</h1>
            <p className="text-sm text-muted-foreground">Onboard and manage originator organizations</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={displayCurrency} onValueChange={(v) => setDisplayCurrency(v as CurrencyCode)}>
              <SelectTrigger className="w-[80px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map(c => (
                  <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Onboard New Originator</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Onboard New Originator</DialogTitle>
                  <DialogDescription>Set up the organization, contact persons, and branding.</DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="general" className="mt-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="contacts">Contact Persons</TabsTrigger>
                    <TabsTrigger value="branding">Branding</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Organization Name</Label>
                      <Input placeholder="Acme Trade Finance" value={newName}
                        onChange={(e) => { setNewName(e.target.value); setNewSlug(generateSlug(e.target.value)); }} />
                    </div>
                    <div className="space-y-2">
                      <Label>Slug</Label>
                      <Input placeholder="acme-trade-finance" value={newSlug}
                        onChange={(e) => setNewSlug(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Labelling Mode</Label>
                      <Select value={newMode} onValueChange={(v) => setNewMode(v as LabellingMode)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="white_label">White Label — Originator's brand only</SelectItem>
                          <SelectItem value="joint_label">Joint Label — Co-branded with Vybrel</SelectItem>
                          <SelectItem value="platform_label">Platform Label — Vybrel branded</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="contacts" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Add contact persons. Each will receive an invitation to join as an Originator Admin.
                    </p>
                    {contacts.map((contact, idx) => (
                      <Card key={idx} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-foreground">Contact {idx + 1}</span>
                          <div className="flex items-center gap-2">
                            {contact.is_primary ? (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-xs h-6"
                                onClick={() => updateContact(idx, "is_primary", true)}>
                                Set Primary
                              </Button>
                            )}
                            {contacts.length > 1 && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeContact(idx)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Input placeholder="Full Name" value={contact.full_name}
                            onChange={(e) => updateContact(idx, "full_name", e.target.value)} />
                          <Input placeholder="Email" type="email" value={contact.email}
                            onChange={(e) => updateContact(idx, "email", e.target.value)} />
                          <Input placeholder="Designation (e.g. CEO, CFO)" value={contact.designation}
                            onChange={(e) => updateContact(idx, "designation", e.target.value)} />
                        </div>
                      </Card>
                    ))}
                    <Button variant="outline" size="sm" onClick={addContact}>
                      <UserPlus className="mr-2 h-3 w-3" /> Add Another Contact
                    </Button>
                  </TabsContent>

                  <TabsContent value="branding" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Primary Color</Label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={newPrimaryColor}
                          onChange={(e) => setNewPrimaryColor(e.target.value)}
                          className="h-10 w-14 rounded border cursor-pointer" />
                        <Input value={newPrimaryColor} onChange={(e) => setNewPrimaryColor(e.target.value)} className="flex-1" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Logo URL</Label>
                      <Input placeholder="https://example.com/logo.png" value={newLogoUrl}
                        onChange={(e) => setNewLogoUrl(e.target.value)} />
                    </div>
                    {newLogoUrl && (
                      <div className="rounded-lg border p-4 bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-2">Preview</p>
                        <img src={newLogoUrl} alt="Logo preview" className="h-12 object-contain" />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create & Send Invitations
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : orgs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">No organizations yet</p>
              <p className="text-sm text-muted-foreground mb-4">Onboard your first originator to get started</p>
              <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Onboard Originator</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {orgs.map((org) => (
              <Card key={org.id} className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedOrgId(org.id)}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: org.branding?.primary_color || "hsl(var(--primary))" }}>
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle className="text-base">{org.name}</CardTitle>
                      <CardDescription className="text-xs">/{org.slug}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(org.onboarding_status)}
                    <Badge variant="outline">{labelModeDisplay(org.labelling_mode)}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Borrowers</p>
                        <p className="text-sm font-semibold text-foreground">{org.borrowerCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Counterparties</p>
                        <p className="text-sm font-semibold text-foreground">{org.counterpartyCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Lenders</p>
                        <p className="text-sm font-semibold text-foreground">{org.lenderCount}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Invoices</p>
                      {renderCurrencyBreakdown(org.monthlyInvoicesByCurrency)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Outstanding</p>
                      {renderCurrencyBreakdown(org.outstandingByCurrency)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
