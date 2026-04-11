import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ─── Products tab ─────────────────────────────────────────────────────────────

function ProductsTab() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const PRODUCT_LABELS: Record<string, string> = {
    receivables_purchase: "Receivables Purchase (Invoice Discounting)",
    reverse_factoring: "Reverse Factoring",
    payables_finance: "Payables Finance",
    invoice_discounting: "Invoice Discounting",
    inventory_finance: "Inventory Finance",
    structured_trade_finance: "Structured Trade Finance",
    working_capital_revolving: "Working Capital Revolving",
  };

  useEffect(() => {
    if (!profile?.organization_id) return;
    setLoading(true);
    supabase
      .from("org_active_products")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("product_type")
      .then(({ data }) => { setProducts(data || []); setLoading(false); });
  }, [profile?.organization_id]);

  const toggleProduct = async (product: any) => {
    setSaving(product.id);
    const newActive = !product.is_active;
    const { error } = await supabase
      .from("org_active_products")
      .update({
        is_active: newActive,
        activated_at: newActive ? new Date().toISOString() : null,
        activated_by: newActive ? (await supabase.auth.getUser()).data.user?.id : null,
        deactivated_at: !newActive ? new Date().toISOString() : null,
        deactivated_by: !newActive ? (await supabase.auth.getUser()).data.user?.id : null,
      })
      .eq("id", product.id);
    if (error) { toast.error("Failed to update product"); }
    else {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: newActive } : p));
      toast.success(`${PRODUCT_LABELS[product.product_type] || product.product_type} ${newActive ? "activated" : "deactivated"}`);
    }
    setSaving(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Activate the trade finance products your organisation offers. Fees are configured on individual Offer Letters and Facilities — not here.
      </p>
      <div className="grid gap-3">
        {products.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">{p.display_name || PRODUCT_LABELS[p.product_type] || p.product_type}</p>
              {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
              {p.is_active && p.activated_at && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Active since {new Date(p.activated_at).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={p.is_active ? "default" : "secondary"} className="text-xs">
                {p.is_active ? "Active" : "Inactive"}
              </Badge>
              {saving === p.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Switch
                  checked={p.is_active}
                  onCheckedChange={() => toggleProduct(p)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Bank Accounts tab ────────────────────────────────────────────────────────

function BankAccountsTab() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    account_name: "",
    bank_name: "",
    account_number: "",
    sort_code: "",
    iban: "",
    bic_swift: "",
    currency: "GBP",
    fee_wallet: "",
    is_primary: false,
  });

  const fetchAccounts = async () => {
    if (!profile?.organization_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("actor_type", "originator")
      .order("created_at", { ascending: false });
    setAccounts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, [profile?.organization_id]);

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: any; icon: any }> = {
      verified: { variant: "default", icon: CheckCircle2 },
      pending_verification: { variant: "secondary", icon: Clock },
      unverified: { variant: "outline", icon: AlertCircle },
      failed: { variant: "destructive", icon: XCircle },
    };
    const { variant, icon: Icon } = map[status] || map["unverified"];
    return <Badge variant={variant} className="gap-1 text-xs"><Icon className="h-3 w-3" />{status.replace("_", " ")}</Badge>;
  };

  const handleAdd = async () => {
    if (!profile?.organization_id) return;
    setSaving(true);
    const { error } = await supabase.from("bank_accounts").insert({
      organization_id: profile.organization_id,
      actor_type: "originator",
      actor_id: profile.organization_id,
      ...form,
    });
    if (error) { toast.error(error.message); }
    else { toast.success("Bank account added"); setAddOpen(false); fetchAccounts(); }
    setSaving(false);
  };

  const handleVerify = async (id: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("bank_accounts").update({
      verification_status: "verified",
      verified_at: new Date().toISOString(),
      verified_by: user?.id,
      verification_method: "manual",
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Account marked as verified"); fetchAccounts(); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Platform bank accounts used for settlements and disbursements.</p>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Account</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account Name</TableHead>
            <TableHead>Bank</TableHead>
            <TableHead>Sort Code / IBAN</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Wallet</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.length === 0 && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No bank accounts configured</TableCell></TableRow>
          )}
          {accounts.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-medium">{a.account_name}{a.is_primary && <Badge variant="outline" className="ml-2 text-[10px]">Primary</Badge>}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{a.bank_name || "—"}</TableCell>
              <TableCell className="text-sm font-mono">{a.sort_code ? a.sort_code : a.iban || "—"}</TableCell>
              <TableCell>{a.currency}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{a.fee_wallet || "General"}</TableCell>
              <TableCell>{statusBadge(a.verification_status)}</TableCell>
              <TableCell>
                {a.verification_status !== "verified" && (
                  <Button variant="ghost" size="sm" onClick={() => handleVerify(a.id)}>Verify</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[
              { key: "account_name", label: "Account Name *" },
              { key: "bank_name", label: "Bank Name" },
              { key: "account_number", label: "Account Number" },
              { key: "sort_code", label: "Sort Code" },
              { key: "iban", label: "IBAN" },
              { key: "bic_swift", label: "BIC / SWIFT" },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="mt-1" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Currency</Label>
                <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="mt-1" maxLength={3} />
              </div>
              <div>
                <Label className="text-xs">Fee Wallet</Label>
                <Input value={form.fee_wallet} onChange={e => setForm(f => ({ ...f, fee_wallet: e.target.value }))} placeholder="e.g. originator_revenue" className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_primary} onCheckedChange={v => setForm(f => ({ ...f, is_primary: v }))} id="primary" />
              <Label htmlFor="primary" className="text-sm">Set as primary account</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !form.account_name}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Templates shortcut ───────────────────────────────────────────────────────

function TemplatesTab() {
  return (
    <div className="py-8 text-center text-muted-foreground space-y-3">
      <p className="text-sm">Document template management is available in the dedicated Templates section.</p>
      <Button variant="outline" onClick={() => window.location.href = "/originator/document-templates"}>
        Open Document Templates
      </Button>
    </div>
  );
}

// ─── Branding shortcut ────────────────────────────────────────────────────────

function BrandingTab() {
  return (
    <div className="py-8 text-center text-muted-foreground space-y-3">
      <p className="text-sm">Manage white-label branding profiles for your borrower and funder portals.</p>
      <Button variant="outline" onClick={() => window.location.href = "/originator/branding-profiles"}>
        Open Branding Profiles
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlatformSettings() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Platform Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure products, branding, templates, and bank accounts for your originator platform.</p>
        </div>

        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="bank-accounts">Bank Accounts</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="mt-4">
            <Card><CardContent className="pt-6"><ProductsTab /></CardContent></Card>
          </TabsContent>

          <TabsContent value="bank-accounts" className="mt-4">
            <Card><CardContent className="pt-6"><BankAccountsTab /></CardContent></Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <Card><CardContent className="pt-6"><TemplatesTab /></CardContent></Card>
          </TabsContent>

          <TabsContent value="branding" className="mt-4">
            <Card><CardContent className="pt-6"><BrandingTab /></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
