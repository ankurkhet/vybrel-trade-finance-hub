import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Loader2, Search, CheckCircle2, XCircle, Eye, Clock, FileCheck, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { FraudBadge } from "@/components/fraud/FraudBadge";
import { FraudAssessmentSection } from "@/components/fraud/FraudAssessmentSection";

const PRODUCT_LABELS: Record<string, string> = {
  receivables_purchase: "Receivables Purchase",
  reverse_factoring: "Reverse Factoring",
  payables_finance: "Payables Finance",
};

export default function Invoices() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [reviewInvoice, setReviewInvoice] = useState<any>(null);
  const [updating, setUpdating] = useState(false);
  const [fraudChecks, setFraudChecks] = useState<Record<string, any>>({});

  useEffect(() => {
    if (profile?.organization_id) fetchInvoices();
  }, [profile]);

  const fetchInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*, borrowers(company_name), invoice_acceptances(*)")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    setInvoices(data || []);

    // Load fraud checks for all invoices
    if (data && data.length > 0) {
      const invoiceIds = data.map((i: any) => i.id);
      const { data: checks } = await supabase
        .from("invoice_fraud_checks" as any)
        .select("*")
        .in("invoice_id", invoiceIds);
      const checkMap: Record<string, any> = {};
      for (const c of checks || []) {
        checkMap[(c as any).invoice_id] = c;
      }
      setFraudChecks(checkMap);
    }

    setLoading(false);
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from("invoices")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) toast.error(error.message);
    else {
      toast.success(`Invoice ${newStatus}`);
      setReviewInvoice(null);
      fetchInvoices();
    }
    setUpdating(false);
  };

  const handleApproveDocAcceptance = async (inv: any) => {
    setUpdating(true);
    // Update both the acceptance record and the invoice
    const { error: accErr } = await supabase
      .from("invoice_acceptances" as any)
      .update({ status: "accepted_via_document" })
      .eq("invoice_id", inv.id)
      .eq("status", "pending_document_review");

    if (accErr) { toast.error(accErr.message); setUpdating(false); return; }

    const { error: invErr } = await supabase
      .from("invoices")
      .update({ acceptance_status: "accepted_via_document" } as any)
      .eq("id", inv.id);

    if (invErr) toast.error(invErr.message);
    else {
      await supabase.from("audit_logs").insert({
        user_id: profile?.user_id, user_email: profile?.email,
        action: "counterparty_doc_accepted", resource_type: "invoice", resource_id: inv.id,
        details: { invoice_number: inv.invoice_number },
      });
      toast.success("Document acceptance approved — invoice can now be funded");
      setReviewInvoice(null);
      fetchInvoices();
    }
    setUpdating(false);
  };

  const handleRejectDocAcceptance = async (inv: any) => {
    setUpdating(true);
    await supabase.from("invoice_acceptances" as any)
      .update({ status: "rejected" })
      .eq("invoice_id", inv.id)
      .eq("status", "pending_document_review");

    await supabase.from("invoices")
      .update({ acceptance_status: "pending" } as any)
      .eq("id", inv.id);

    toast.warning("Document acceptance rejected — borrower must re-submit");
    setReviewInvoice(null);
    fetchInvoices();
    setUpdating(false);
  };

  const canApprove = (inv: any) => {
    if (inv.status !== "pending") return false;
    if (inv.requires_counterparty_acceptance) {
      return inv.acceptance_status === "accepted" || inv.acceptance_status === "accepted_via_document";
    }
    return true;
  };

  const filtered = invoices.filter((inv) => {
    const matchSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.debtor_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchProduct = productFilter === "all" || inv.product_type === productFilter;
    return matchSearch && matchStatus && matchProduct;
  });

  const statusColor = (s: string): string => {
    switch (s) {
      case "approved": case "funded": return "default";
      case "rejected": return "destructive";
      case "under_review": return "secondary";
      default: return "outline";
    }
  };

  const acceptanceBadge = (inv: any) => {
    if (!inv.requires_counterparty_acceptance) {
      return <Badge variant="outline" className="text-xs">Not Required</Badge>;
    }
    switch (inv.acceptance_status) {
      case "accepted":
        return <Badge variant="default" className="text-xs"><CheckCircle2 className="mr-1 h-3 w-3" />CP Accepted</Badge>;
      case "accepted_via_document":
        return <Badge variant="default" className="text-xs"><FileCheck className="mr-1 h-3 w-3" />Doc Accepted</Badge>;
      case "pending_document_review":
        return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-300"><Clock className="mr-1 h-3 w-3" />Doc Pending Review</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-xs"><XCircle className="mr-1 h-3 w-3" />CP Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs"><Clock className="mr-1 h-3 w-3" />Awaiting CP</Badge>;
    }
  };

  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === "pending").length,
    approved: invoices.filter((i) => i.status === "approved").length,
    flagged: invoices.filter((i) => i.fraud_status === "flagged" || i.fraud_status === "blocked").length,
    awaitingCP: invoices.filter((i) => i.requires_counterparty_acceptance && i.acceptance_status === "pending").length,
    totalValue: invoices.reduce((sum, i) => sum + Number(i.amount), 0),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">Review and manage borrower invoices</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { label: "Total", value: stats.total },
            { label: "Pending Review", value: stats.pending },
            { label: "Approved", value: stats.approved },
            { label: "Awaiting Counterparty", value: stats.awaitingCP },
            { label: "Total Value", value: `$${stats.totalValue.toLocaleString()}` },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="funded">Funded</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="receivables_purchase">Receivables Purchase</SelectItem>
              <SelectItem value="reverse_factoring">Reverse Factoring</SelectItem>
              <SelectItem value="payables_finance">Payables Finance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <CreditCard className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No invoices found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Debtor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Acceptance</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {PRODUCT_LABELS[inv.product_type] || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>{(inv.borrowers as any)?.company_name || "—"}</TableCell>
                      <TableCell>{inv.debtor_name}</TableCell>
                      <TableCell>{inv.currency} {Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(inv.status) as any} className="capitalize text-xs">
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{acceptanceBadge(inv)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {canApprove(inv) && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600"
                                onClick={() => handleStatusUpdate(inv.id, "approved")} disabled={updating}>
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                                onClick={() => handleStatusUpdate(inv.id, "rejected")} disabled={updating}>
                                <XCircle className="mr-1 h-3 w-3" /> Reject
                              </Button>
                            </>
                          )}
                          {inv.status === "pending" && inv.requires_counterparty_acceptance && inv.acceptance_status === "pending" && (
                            <Badge variant="secondary" className="text-xs">
                              <Clock className="mr-1 h-3 w-3" /> Waiting
                            </Badge>
                          )}
                          <Button size="sm" variant="ghost" className="h-7"
                            onClick={() => setReviewInvoice(inv)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!reviewInvoice} onOpenChange={() => setReviewInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>{reviewInvoice?.invoice_number}</DialogDescription>
          </DialogHeader>
          {reviewInvoice && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Product:</span> <span className="text-foreground font-medium">{PRODUCT_LABELS[reviewInvoice.product_type] || "—"}</span></div>
                <div><span className="text-muted-foreground">Debtor:</span> <span className="text-foreground font-medium">{reviewInvoice.debtor_name}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="text-foreground font-medium">{reviewInvoice.currency} {Number(reviewInvoice.amount).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Due Date:</span> <span className="text-foreground">{new Date(reviewInvoice.due_date).toLocaleDateString()}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusColor(reviewInvoice.status) as any} className="capitalize text-xs ml-1">{reviewInvoice.status}</Badge></div>
                {reviewInvoice.match_score && <div><span className="text-muted-foreground">Match Score:</span> <span className="text-foreground">{reviewInvoice.match_score}%</span></div>}
              </div>

              {reviewInvoice.requires_counterparty_acceptance && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Counterparty Acceptance</Label>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Counterparty:</span> <span className="text-foreground">{reviewInvoice.counterparty_name || reviewInvoice.counterparty_email || "—"}</span></div>
                      <div><span className="text-muted-foreground">Status:</span> {acceptanceBadge(reviewInvoice)}</div>
                    </div>
                    {reviewInvoice.invoice_acceptances?.length > 0 && (
                      <div className="rounded-lg border p-3 space-y-2 text-sm">
                        <p className="font-medium text-foreground">Acceptance Records</p>
                        {reviewInvoice.invoice_acceptances.map((acc: any) => (
                          <div key={acc.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {acc.method === "direct_counterparty" ? "Direct verification" : "Document upload"} by {acc.accepted_by_email}
                            </span>
                            <Badge variant={acc.status === "accepted" || acc.status === "accepted_via_document" ? "default" : "destructive"} className="text-xs capitalize">
                              {acc.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {/* GAP-15: Ops Manager Doc Acceptance Review */}
            {reviewInvoice && (reviewInvoice.acceptance_status === "pending_document_review") && (
              <div className="w-full rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 mb-2">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">Ops Manager Review Required</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                  The borrower has uploaded acceptance evidence. Review and decide whether to approve or reject this documentation.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/30"
                    onClick={() => handleRejectDocAcceptance(reviewInvoice)} disabled={updating}>
                    <XCircle className="mr-1 h-3 w-3" /> Reject Evidence
                  </Button>
                  <Button size="sm" onClick={() => handleApproveDocAcceptance(reviewInvoice)} disabled={updating}>
                    {updating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    <FileCheck className="mr-1 h-3 w-3" /> Approve Evidence
                  </Button>
                </div>
              </div>
            )}
            {reviewInvoice && canApprove(reviewInvoice) && (
              <>
                <Button variant="outline" className="text-destructive" onClick={() => handleStatusUpdate(reviewInvoice.id, "rejected")} disabled={updating}>
                  <XCircle className="mr-1 h-4 w-4" /> Reject
                </Button>
                <Button onClick={() => handleStatusUpdate(reviewInvoice.id, "approved")} disabled={updating}>
                  {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setReviewInvoice(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
