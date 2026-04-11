import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Plus, Search, CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const KYB_BADGE: Record<string, any> = {
  approved:   { variant: "default",      icon: CheckCircle2, label: "Approved" },
  in_review:  { variant: "secondary",    icon: Clock,        label: "In Review" },
  pending:    { variant: "outline",      icon: AlertCircle,  label: "Pending" },
  rejected:   { variant: "destructive",  icon: XCircle,      label: "Rejected" },
  suspended:  { variant: "destructive",  icon: XCircle,      label: "Suspended" },
};

export default function Brokers() {
  const { profile } = useAuth();
  const [brokers, setBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    trading_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    registration_number: "",
    country: "GB",
    fee_pct: "0",
    scope: "all_borrowers",
  });

  const fetchBrokers = async () => {
    if (!profile?.organization_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("brokers")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });
    setBrokers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchBrokers(); }, [profile?.organization_id]);

  const handleAdd = async () => {
    if (!profile?.organization_id) return;
    setSaving(true);
    const { error } = await supabase.from("brokers").insert({
      organization_id: profile.organization_id,
      company_name: form.company_name,
      trading_name: form.trading_name || null,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone || null,
      registration_number: form.registration_number || null,
      country: form.country || null,
      fee_pct: parseFloat(form.fee_pct) || 0,
      scope: form.scope,
    });
    if (error) toast.error(error.message);
    else { toast.success("Broker added"); setAddOpen(false); fetchBrokers(); }
    setSaving(false);
  };

  const updateKybStatus = async (id: string, status: string) => {
    const user = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("brokers").update({
      kyb_status: status,
      kyb_reviewed_at: new Date().toISOString(),
      kyb_reviewed_by: user?.id,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(`KYB status set to ${status}`); setReviewOpen(null); fetchBrokers(); }
  };

  const filtered = brokers.filter(b =>
    b.company_name.toLowerCase().includes(search.toLowerCase()) ||
    b.contact_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Brokers</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage broker relationships and KYB status.</p>
          </div>
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Broker</Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search brokers..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Badge variant="secondary">{brokers.length} broker{brokers.length !== 1 ? "s" : ""}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Broker Fee %</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>NDA</TableHead>
                    <TableHead>KYB Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No brokers found</TableCell></TableRow>
                  )}
                  {filtered.map((b) => {
                    const kyb = KYB_BADGE[b.kyb_status] || KYB_BADGE["pending"];
                    const KybIcon = kyb.icon;
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{b.company_name}</p>
                          {b.trading_name && <p className="text-xs text-muted-foreground">{b.trading_name}</p>}
                          {b.registration_number && <p className="text-[11px] text-muted-foreground font-mono">{b.registration_number}</p>}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{b.contact_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{b.contact_email}</p>
                        </TableCell>
                        <TableCell className="text-sm">{b.country || "—"}</TableCell>
                        <TableCell className="text-sm font-mono">{(parseFloat(b.fee_pct) * 100).toFixed(3)}%</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{b.scope === "all_borrowers" ? "All Borrowers" : "Specific"}</Badge>
                        </TableCell>
                        <TableCell>
                          {b.nda_accepted ? (
                            <Badge variant="default" className="gap-1 text-xs"><CheckCircle2 className="h-3 w-3" />Accepted</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={kyb.variant} className="gap-1 text-xs">
                            <KybIcon className="h-3 w-3" />{kyb.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setReviewOpen(b)}>Review</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Broker Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Broker</DialogTitle>
              <DialogDescription>Register a new broker entity. They will receive an invitation to complete onboarding and sign the NDA.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Company Name *</Label>
                  <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Trading Name</Label>
                  <Input value={form.trading_name} onChange={e => setForm(f => ({ ...f, trading_name: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Contact Name</Label>
                  <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Contact Email *</Label>
                  <Input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Company Reg. No.</Label>
                  <Input value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Country</Label>
                  <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="mt-1" maxLength={2} />
                </div>
                <div>
                  <Label className="text-xs">Broker Fee %</Label>
                  <Input type="number" step="0.001" value={form.fee_pct} onChange={e => setForm(f => ({ ...f, fee_pct: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Scope</Label>
                  <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_borrowers">All Borrowers</SelectItem>
                      <SelectItem value="specific_borrower">Specific Borrower</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving || !form.company_name || !form.contact_email}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Add Broker
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* KYB Review Dialog */}
        {reviewOpen && (
          <Dialog open={!!reviewOpen} onOpenChange={() => setReviewOpen(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>KYB Review — {reviewOpen.company_name}</DialogTitle>
                <DialogDescription>Update KYB status for this broker.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <p className="text-sm"><span className="font-medium">Email:</span> {reviewOpen.contact_email}</p>
                <p className="text-sm"><span className="font-medium">Reg. No.:</span> {reviewOpen.registration_number || "—"}</p>
                <p className="text-sm"><span className="font-medium">Country:</span> {reviewOpen.country || "—"}</p>
                <p className="text-sm"><span className="font-medium">Current status:</span> {reviewOpen.kyb_status}</p>
              </div>
              <DialogFooter className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => updateKybStatus(reviewOpen.id, "in_review")}>Mark In Review</Button>
                <Button variant="default" onClick={() => updateKybStatus(reviewOpen.id, "approved")}>Approve</Button>
                <Button variant="destructive" onClick={() => updateKybStatus(reviewOpen.id, "rejected")}>Reject</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
