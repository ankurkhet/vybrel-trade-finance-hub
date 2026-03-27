import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, Receipt, Inbox, CheckCircle2, XCircle, Eye, Banknote, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Disbursements() {
  const { profile } = useAuth();
  const [memos, setMemos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailMemo, setDetailMemo] = useState<any>(null);
  const [approving, setApproving] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<any>(null);
  const [paymentData, setPaymentData] = useState({ payment_date: "", payment_reference: "" });

  // Create disbursement state
  const [createDialog, setCreateDialog] = useState(false);
  const [approvedInvoices, setApprovedInvoices] = useState<any[]>([]);
  const [approvedFacilities, setApprovedFacilities] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState("");
  const [selectedFacility, setSelectedFacility] = useState("");
  const [disbForm, setDisbForm] = useState({
    advance_rate: "80",
    originator_fee: "0",
    funder_fee: "0",
    funder_name: "",
  });

  useEffect(() => {
    if (profile?.organization_id) fetchMemos();
  }, [profile]);

  const fetchMemos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("disbursement_memos")
      .select("*, borrowers(company_name)")
      .eq("organization_id", profile!.organization_id!)
      .order("created_at", { ascending: false });
    setMemos(data || []);
    setLoading(false);
  };

  const handleApprove = async (memo: any) => {
    setApproving(true);
    const { error } = await supabase.from("disbursement_memos").update({
      status: "approved",
      approved_by: profile?.user_id,
      approved_at: new Date().toISOString(),
    }).eq("id", memo.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Disbursement memo approved");
      await supabase.from("audit_logs").insert({
        user_id: profile?.user_id, user_email: profile?.email,
        action: "disbursement_approved", resource_type: "disbursement_memo", resource_id: memo.id,
        details: { memo_number: memo.memo_number, amount: memo.disbursement_amount },
      });
    }
    setApproving(false);
    setDetailMemo(null);
    fetchMemos();
  };

  const handleReject = async (memo: any) => {
    const { error } = await supabase.from("disbursement_memos").update({ status: "rejected" }).eq("id", memo.id);
    if (error) toast.error(error.message);
    else toast.success("Disbursement memo rejected");
    setDetailMemo(null);
    fetchMemos();
  };

  const openCreateDialog = async () => {
    const [{ data: invs }, { data: facs }] = await Promise.all([
      supabase.from("invoices").select("*, borrowers(company_name)")
        .eq("organization_id", profile!.organization_id!)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabase.from("facility_requests").select("*, borrowers(company_name)")
        .eq("organization_id", profile!.organization_id!)
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
    ]);
    setApprovedInvoices(invs || []);
    setApprovedFacilities(facs || []);
    setCreateDialog(true);
  };

  const handleCreateDisbursement = async () => {
    if (!selectedInvoice) { toast.error("Select an invoice"); return; }
    const inv = approvedInvoices.find(i => i.id === selectedInvoice);
    if (!inv) return;

    const advanceRate = Number(disbForm.advance_rate) / 100;
    const invoiceValue = Number(inv.amount);
    const advanceAmount = invoiceValue * advanceRate;
    const retainedAmount = invoiceValue - advanceAmount;
    const origFee = Number(disbForm.originator_fee) || 0;
    const funderFee = Number(disbForm.funder_fee) || 0;
    const totalFee = origFee + funderFee;
    const disbursementAmount = advanceAmount - totalFee;

    const memoNumber = `DM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(memos.length + 1).padStart(4, "0")}`;

    const { error } = await supabase.from("disbursement_memos").insert({
      organization_id: profile!.organization_id!,
      borrower_id: inv.borrower_id,
      invoice_id: inv.id,
      facility_request_id: selectedFacility || null,
      memo_number: memoNumber,
      invoice_number: inv.invoice_number,
      invoice_value: invoiceValue,
      invoice_date: inv.issue_date,
      invoice_due_date: inv.due_date,
      counterparty_name: inv.debtor_name,
      funder_name: disbForm.funder_name || null,
      advance_rate: Number(disbForm.advance_rate),
      advance_amount: advanceAmount,
      retained_amount: retainedAmount,
      originator_fee: origFee,
      funder_fee: funderFee,
      total_fee: totalFee,
      disbursement_amount: disbursementAmount,
      status: "pending",
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Disbursement memo created");
      await supabase.from("audit_logs").insert({
        user_id: profile?.user_id, user_email: profile?.email,
        action: "disbursement_created", resource_type: "disbursement_memo",
        details: { invoice_id: inv.id, facility_request_id: selectedFacility, amount: disbursementAmount },
      });
    }
    setCreateDialog(false);
    setSelectedInvoice("");
    setSelectedFacility("");
    setDisbForm({ advance_rate: "80", originator_fee: "0", funder_fee: "0", funder_name: "" });
    fetchMemos();
  };

  const handlePaymentConfirm = async () => {
    if (!paymentDialog) return;
    const { error } = await supabase.from("disbursement_memos").update({
      status: "disbursed",
      disbursed_at: paymentData.payment_date || new Date().toISOString(),
      payment_reference: paymentData.payment_reference,
      payment_date: paymentData.payment_date || new Date().toISOString(),
    }).eq("id", paymentDialog.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Payment confirmed — disbursement advise generated");
      await supabase.from("audit_logs").insert({
        user_id: profile?.user_id, user_email: profile?.email,
        action: "disbursement_payment_confirmed", resource_type: "disbursement_memo", resource_id: paymentDialog.id,
        details: { ...paymentData },
      });
    }
    setPaymentDialog(null);
    setPaymentData({ payment_date: "", payment_reference: "" });
    fetchMemos();
  };

  const filtered = memos.filter(m => {
    const matchSearch = (m.memo_number || "").toLowerCase().includes(search.toLowerCase()) ||
      ((m.borrowers as any)?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.counterparty_name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="text-xs bg-primary/80">Approved</Badge>;
      case "disbursed": return <Badge className="text-xs">Disbursed</Badge>;
      case "rejected": return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Pending</Badge>;
    }
  };

  const totalDisbursed = memos.filter(m => m.status === "disbursed").reduce((s, m) => s + Number(m.disbursement_amount || 0), 0);
  const pendingCount = memos.filter(m => m.status === "pending").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disbursement Memos</h1>
          <p className="text-sm text-muted-foreground">Review and approve funding disbursements</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><Receipt className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{memos.length}</p><p className="text-xs text-muted-foreground">Total Memos</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--chart-4))]/10"><Banknote className="h-5 w-5 text-[hsl(var(--chart-4))]" /></div>
            <div><p className="text-2xl font-bold">{pendingCount}</p><p className="text-xs text-muted-foreground">Pending Approval</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--chart-2))]/10"><CheckCircle2 className="h-5 w-5 text-[hsl(var(--chart-2))]" /></div>
            <div><p className="text-2xl font-bold">GBP {totalDisbursed.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Disbursed</p></div>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search memos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="disbursed">Disbursed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No disbursement memos found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Memo #</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Invoice Value</TableHead>
                    <TableHead>Advance</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Disbursement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-xs">{m.memo_number || "—"}</TableCell>
                      <TableCell className="text-sm">{(m.borrowers as any)?.company_name || "—"}</TableCell>
                      <TableCell className="text-sm">{m.counterparty_name || "—"}</TableCell>
                      <TableCell className="text-xs">{m.invoice_number || "—"}</TableCell>
                      <TableCell className="text-sm">{Number(m.invoice_value || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{Number(m.advance_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{Number(m.total_fee || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-medium text-sm">{Number(m.disbursement_amount || 0).toLocaleString()}</TableCell>
                      <TableCell>{statusBadge(m.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailMemo(m)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail & Approval Dialog */}
      <Dialog open={!!detailMemo} onOpenChange={() => setDetailMemo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Disbursement Memo</DialogTitle>
            <DialogDescription>{detailMemo?.memo_number}</DialogDescription>
          </DialogHeader>
          {detailMemo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <MemoField label="Funder / Lender" value={detailMemo.funder_name} />
                <MemoField label="Borrower" value={(detailMemo.borrowers as any)?.company_name} />
                <MemoField label="Counterparty" value={detailMemo.counterparty_name} />
                <MemoField label="Invoice #" value={detailMemo.invoice_number} />
                <MemoField label="Invoice Date" value={detailMemo.invoice_date ? new Date(detailMemo.invoice_date).toLocaleDateString() : undefined} />
                <MemoField label="Due Date" value={detailMemo.invoice_due_date ? new Date(detailMemo.invoice_due_date).toLocaleDateString() : undefined} />
              </div>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Financial Breakdown</h4>
                <div className="rounded-lg border divide-y">
                  <MemoRow label="Invoice Value" value={Number(detailMemo.invoice_value || 0).toLocaleString()} />
                  <MemoRow label={`Advance Amount (${detailMemo.advance_rate ? `${detailMemo.advance_rate}%` : "—"})`} value={Number(detailMemo.advance_amount || 0).toLocaleString()} />
                  <MemoRow label="Retained Amount" value={Number(detailMemo.retained_amount || 0).toLocaleString()} />
                  <MemoRow label="Originator Fee" value={Number(detailMemo.originator_fee || 0).toLocaleString()} />
                  <MemoRow label="Funder Fee" value={Number(detailMemo.funder_fee || 0).toLocaleString()} />
                  <MemoRow label="Total Fee" value={Number(detailMemo.total_fee || 0).toLocaleString()} />
                  <MemoRow label="Disbursement Amount" value={Number(detailMemo.disbursement_amount || 0).toLocaleString()} bold />
                </div>
              </div>

              {detailMemo.payment_reference && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <p className="text-muted-foreground">Payment Reference: <span className="font-medium text-foreground">{detailMemo.payment_reference}</span></p>
                    {detailMemo.payment_date && <p className="text-muted-foreground">Payment Date: <span className="font-medium text-foreground">{new Date(detailMemo.payment_date).toLocaleDateString()}</span></p>}
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                {detailMemo.status === "pending" && (
                  <>
                    <Button className="flex-1" onClick={() => handleApprove(detailMemo)} disabled={approving}>
                      {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Approve
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => handleReject(detailMemo)}>
                      <XCircle className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </>
                )}
                {detailMemo.status === "approved" && (
                  <Button className="w-full" onClick={() => { setPaymentDialog(detailMemo); setDetailMemo(null); }}>
                    <Banknote className="mr-2 h-4 w-4" /> Confirm Payment
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={() => setPaymentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Disbursement Payment</DialogTitle>
            <DialogDescription>Enter payment details from the payment provider</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Payment / Disbursement Date</Label>
              <Input type="date" value={paymentData.payment_date} onChange={(e) => setPaymentData(prev => ({ ...prev, payment_date: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Bank Payment Reference</Label>
              <Input value={paymentData.payment_reference} onChange={(e) => setPaymentData(prev => ({ ...prev, payment_reference: e.target.value }))} placeholder="e.g. TRN-2026-001234" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(null)}>Cancel</Button>
            <Button onClick={handlePaymentConfirm}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function MemoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <p className="font-medium text-sm">{value || "—"}</p>
    </div>
  );
}

function MemoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between px-4 py-2 text-sm ${bold ? "font-bold bg-muted/50" : ""}`}>
      <span className={bold ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
