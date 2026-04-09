import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, Inbox, CheckCircle2, XCircle, Eye, ArrowDownUp, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Repayments() {
  const { profile } = useAuth();
  const [memos, setMemos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailMemo, setDetailMemo] = useState<any>(null);
  const [approving, setApproving] = useState(false);

  const [createDialog, setCreateDialog] = useState(false);
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const [selectedDisbursement, setSelectedDisbursement] = useState("");
  const [repaymentForm, setRepaymentForm] = useState({
    repayment_date: new Date().toISOString().split("T")[0],
    total_repayment: "",
    overdue_fee: "0",
    payment_reference: "",
  });

  useEffect(() => {
    if (profile?.organization_id) fetchMemos();
  }, [profile]);

  const fetchMemos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("repayment_memos")
      .select("*, borrowers(company_name)")
      .eq("organization_id", profile!.organization_id!)
      .order("created_at", { ascending: false });
    setMemos(data || []);
    setLoading(false);
  };

  const openCreateDialog = async () => {
    const { data } = await supabase
      .from("disbursement_memos")
      .select("*, borrowers(company_name)")
      .eq("organization_id", profile!.organization_id!)
      .eq("status", "disbursed")
      .order("created_at", { ascending: false });
    setDisbursements(data || []);
    setCreateDialog(true);
  };

  const handleCreate = async () => {
    if (!selectedDisbursement) { toast.error("Select a disbursement"); return; }
    const disb = disbursements.find(d => d.id === selectedDisbursement);
    if (!disb) return;

    const repaymentAmount = Number(repaymentForm.total_repayment) || 0;
    const overdueF = Number(repaymentForm.overdue_fee) || 0;
    const balanceDue = Math.max(0, Number(disb.advance_amount) - repaymentAmount);
    const retainedReimb = Math.max(0, Number(disb.retained_amount) - balanceDue - overdueF);

    const { error } = await supabase.from("repayment_memos").insert({
      organization_id: profile!.organization_id!,
      borrower_id: disb.borrower_id,
      disbursement_memo_id: disb.id,
      invoice_id: disb.invoice_id,
      invoice_number: disb.invoice_number,
      invoice_value: disb.invoice_value,
      invoice_date: disb.invoice_date,
      invoice_due_date: disb.invoice_due_date,
      counterparty_name: disb.counterparty_name,
      funder_name: disb.funder_name,
      funding_amount: disb.advance_amount,
      total_fee: disb.total_fee,
      originator_fee: disb.originator_fee,
      funder_fee: disb.funder_fee,
      disbursement_amount: disb.disbursement_amount,
      repayment_date: repaymentForm.repayment_date,
      total_repayment: repaymentAmount,
      balance_due: balanceDue,
      overdue_fee: overdueF,
      retained_reimbursement: retainedReimb,
      payment_reference: repaymentForm.payment_reference || null,
      status: "pending",
      created_by: profile!.id,
    } as any);

    if (error) toast.error(error.message);
    else {
      toast.success("Repayment memo created");
      await supabase.from("audit_logs").insert({
        user_id: profile?.id, user_email: profile?.email,
        action: "repayment_memo_created", resource_type: "repayment_memo",
        details: { disbursement_memo_id: disb.id, repayment_amount: repaymentAmount },
      });
    }
    setCreateDialog(false);
    setSelectedDisbursement("");
    setRepaymentForm({ repayment_date: new Date().toISOString().split("T")[0], total_repayment: "", overdue_fee: "0", payment_reference: "" });
    fetchMemos();
  };

  const handleApprove = async (memo: any) => {
    // GAP-34: Maker-checker — cannot approve your own repayment memo
    if (memo.created_by === profile?.id) {
      toast.error("Maker-Checker Rule: You cannot approve a repayment you created.");
      return;
    }
    setApproving(true);
    const { error } = await supabase.from("repayment_memos").update({
      status: "approved", approved_by: profile?.id, approved_at: new Date().toISOString(),
    }).eq("id", memo.id);
    if (error) {
       toast.error(error.message);
    } else {
      toast.success("Repayment memo approved");
      
      // Update Invoice settlement status based on balance due
      const newInvoiceStatus = Number(memo.balance_due) > 0 ? "partially_settled" : "settled";
      await supabase.from("invoices").update({ status: newInvoiceStatus }).eq("id", memo.invoice_id);

      if (newInvoiceStatus === "settled") {
        // GAP-17: Cascade settled status to flag underlying memo as repaid
        await supabase.from("disbursement_memos").update({ status: "repaid" }).eq("id", memo.disbursement_memo_id);
      }

      await supabase.from("audit_logs").insert({
        user_id: profile?.id, user_email: profile?.email,
        action: "repayment_approved", resource_type: "repayment_memo", resource_id: memo.id,
      });
    }
    setApproving(false);
    setDetailMemo(null);
    fetchMemos();
  };

  const handleReject = async (memo: any) => {
    await supabase.from("repayment_memos").update({ status: "rejected" }).eq("id", memo.id);
    toast.success("Repayment memo rejected");
    setDetailMemo(null);
    fetchMemos();
  };

  const filtered = memos.filter(m => {
    const matchSearch = (m.invoice_number || "").toLowerCase().includes(search.toLowerCase()) ||
      ((m.borrowers as any)?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.counterparty_name || "").toLowerCase().includes(search.toLowerCase());
    return (statusFilter === "all" || m.status === statusFilter) && matchSearch;
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge className="text-xs">Approved</Badge>;
      case "rejected": return <Badge variant="destructive" className="text-xs">Rejected</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Pending</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Repayment Memos</h1>
            <p className="text-sm text-muted-foreground">Create and manage repayment confirmations</p>
          </div>
          <Button onClick={openCreateDialog}><Plus className="mr-2 h-4 w-4" /> Create Repayment</Button>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No repayment memos yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Memo #</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Repayment</TableHead>
                    <TableHead>Balance Due</TableHead>
                    <TableHead>Retained Reimb.</TableHead>
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
                      <TableCell className="font-medium text-sm">{Number(m.total_repayment || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{Number(m.balance_due || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{Number(m.retained_reimbursement || 0).toLocaleString()}</TableCell>
                      <TableCell>{statusBadge(m.status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailMemo(m)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail */}
      <Dialog open={!!detailMemo} onOpenChange={() => setDetailMemo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowDownUp className="h-5 w-5 text-primary" /> Repayment Memo</DialogTitle>
            <DialogDescription>{detailMemo?.memo_number}</DialogDescription>
          </DialogHeader>
          {detailMemo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <MF label="Funder" value={detailMemo.funder_name} />
                <MF label="Borrower" value={(detailMemo.borrowers as any)?.company_name} />
                <MF label="Counterparty" value={detailMemo.counterparty_name} />
                <MF label="Invoice" value={detailMemo.invoice_number} />
                <MF label="Invoice Date" value={detailMemo.invoice_date ? new Date(detailMemo.invoice_date).toLocaleDateString() : undefined} />
                <MF label="Due Date" value={detailMemo.invoice_due_date ? new Date(detailMemo.invoice_due_date).toLocaleDateString() : undefined} />
                <MF label="Repayment Date" value={detailMemo.repayment_date ? new Date(detailMemo.repayment_date).toLocaleDateString() : undefined} />
              </div>
              <Separator />
              <div className="rounded-lg border divide-y">
                <MR label="Invoice Value" value={Number(detailMemo.invoice_value || 0).toLocaleString()} />
                <MR label="Funding Amount" value={Number(detailMemo.funding_amount || 0).toLocaleString()} />
                <MR label="Fee (Originator)" value={Number(detailMemo.originator_fee || 0).toLocaleString()} />
                <MR label="Fee (Funder)" value={Number(detailMemo.funder_fee || 0).toLocaleString()} />
                <MR label="Disbursement" value={Number(detailMemo.disbursement_amount || 0).toLocaleString()} />
                <MR label="Repayment Amount" value={Number(detailMemo.total_repayment || 0).toLocaleString()} bold />
                <MR label="Balance Due" value={Number(detailMemo.balance_due || 0).toLocaleString()} />
                <MR label="Overdue Fee" value={Number(detailMemo.overdue_fee || 0).toLocaleString()} />
                <MR label="Retained Reimbursed" value={Number(detailMemo.retained_reimbursement || 0).toLocaleString()} bold />
              </div>
              <p className="text-xs text-muted-foreground italic">Retained Reimb. = Original Retained − Balance Due − Overdue Fee</p>

              {detailMemo.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" onClick={() => handleApprove(detailMemo)} disabled={approving}>
                    {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Approve
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => handleReject(detailMemo)}>
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Repayment Memo</DialogTitle>
            <DialogDescription>Select a disbursed funding to create a repayment against</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Disbursement</Label>
              <Select value={selectedDisbursement} onValueChange={setSelectedDisbursement}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {disbursements.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.memo_number || d.id.slice(0, 8)} — {(d.borrowers as any)?.company_name} — {d.invoice_number || "N/A"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Repayment Date</Label>
                <Input type="date" value={repaymentForm.repayment_date} onChange={(e) => setRepaymentForm(p => ({ ...p, repayment_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Repayment Amount</Label>
                <Input type="number" value={repaymentForm.total_repayment} onChange={(e) => setRepaymentForm(p => ({ ...p, total_repayment: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Overdue Fee</Label>
                <Input type="number" value={repaymentForm.overdue_fee} onChange={(e) => setRepaymentForm(p => ({ ...p, overdue_fee: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Payment Reference</Label>
                <Input value={repaymentForm.payment_reference} onChange={(e) => setRepaymentForm(p => ({ ...p, payment_reference: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function MF({ label, value }: { label: string; value?: string | null }) {
  return <div><span className="text-muted-foreground text-xs">{label}</span><p className="font-medium text-sm">{value || "—"}</p></div>;
}
function MR({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex justify-between px-4 py-2 text-sm ${bold ? "font-bold bg-muted/50" : ""}`}><span className={bold ? "text-foreground" : "text-muted-foreground"}>{label}</span><span className="text-foreground">{value}</span></div>;
}
