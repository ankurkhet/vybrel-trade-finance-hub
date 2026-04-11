import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Plus, Banknote, FileText, CheckCircle2, Clock,
  Download, ArrowRight, Receipt, AlertTriangle, RefreshCw,
  ExternalLink, ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RepaymentsContent } from "./Repayments";
import { useNavigate } from "react-router-dom";

const PRODUCT_LABELS: Record<string, string> = {
  receivables_purchase: "Receivables Purchase",
  reverse_factoring: "Reverse Factoring",
  payables_finance: "Payables Finance",
};

export default function Collections() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [collections, setCollections] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [fundedInvoices, setFundedInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("collections");
  const [feeAlertCount, setFeeAlertCount] = useState(0);

  // Record collection dialog
  const [collectDialogOpen, setCollectDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [collectedAmount, setCollectedAmount] = useState("");
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentRef, setPaymentRef] = useState("");
  const [collectionNotes, setCollectionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Settlement detail dialog
  const [detailAdvice, setDetailAdvice] = useState<any>(null);

  useEffect(() => {
    if (profile?.organization_id) fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    const orgId = profile!.organization_id;

    const [colRes, settRes, invRes] = await Promise.all([
      supabase
        .from("collections")
        .select("*, invoices(invoice_number, debtor_name, amount, currency, product_type, borrowers(company_name))")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("settlement_advices")
        .select("*, invoices(invoice_number, debtor_name, amount, currency)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("*, borrowers(company_name), accrued_late_fees")
        .eq("organization_id", orgId)
        .in("status", ["funded", "approved"])
        .order("due_date", { ascending: true }),
    ]);

    setCollections(colRes.data || []);
    setSettlements(settRes.data || []);
    setFundedInvoices(invRes.data || []);

    // Count pending fee resolution tasks
    const { count } = await supabase
      .from("fee_resolution_tasks" as any)
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending");
    setFeeAlertCount(count || 0);

    setLoading(false);
  };

  const openCollectDialog = (invoice: any) => {
    setSelectedInvoice(invoice);
    setCollectedAmount(String(invoice.amount));
    setPaymentRef("");
    setCollectionNotes("");
    setCollectDialogOpen(true);
  };

  const handleRecordCollection = async () => {
    if (!selectedInvoice || !collectedAmount || !collectionDate) {
      toast.error("Please fill all required fields");
      return;
    }
    setSubmitting(true);

    // Create collection record
    const { data: col, error: colErr } = await supabase
      .from("collections")
      .insert({
        organization_id: profile!.organization_id,
        invoice_id: selectedInvoice.id,
        collected_amount: parseFloat(collectedAmount),
        currency: selectedInvoice.currency || "GBP",
        collection_date: collectionDate,
        payment_reference: paymentRef || null,
        debtor_name: selectedInvoice.debtor_name,
        status: "received",
        notes: collectionNotes || null,
      } as any)
      .select()
      .single();

    if (colErr) {
      toast.error("Failed to record collection: " + colErr.message);
      setSubmitting(false);
      return;
    }

    toast.success("Collection recorded. Generating settlement advices...");

    // Trigger settlement generation
    const { data: settResult, error: settErr } = await supabase.functions.invoke(
      "generate-settlement",
      { body: { collection_id: col!.id } }
    );

    if (settErr) {
      toast.error("Collection recorded but settlement generation failed");
      console.error("Settlement error:", settErr);
    } else {
      toast.success(`Settlement advices generated: ${settResult?.advices_generated || 0}`);
    }

    setCollectDialogOpen(false);
    setSelectedInvoice(null);
    setSubmitting(false);
    fetchData();
  };

  const collectionStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed": return <Badge variant="default" className="text-xs">Confirmed</Badge>;
      case "disputed": return <Badge variant="destructive" className="text-xs">Disputed</Badge>;
      case "reversed": return <Badge variant="destructive" className="text-xs">Reversed</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Received</Badge>;
    }
  };

  const settlementStatusBadge = (status: string) => {
    switch (status) {
      case "issued": return <Badge variant="default" className="text-xs">Issued</Badge>;
      case "acknowledged": return <Badge className="text-xs bg-primary/80">Acknowledged</Badge>;
      case "paid": return <Badge className="text-xs bg-primary">Paid</Badge>;
      default: return <Badge variant="secondary" className="text-xs">Draft</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Collections & Settlements</h1>
          <p className="text-sm text-muted-foreground">
            Record debtor payments and generate settlement advices
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Banknote className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{collections.length}</p>
                <p className="text-xs text-muted-foreground">Collections</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{settlements.length}</p>
                <p className="text-xs text-muted-foreground">Settlement Advices</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/50">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fundedInvoices.length}</p>
                <p className="text-xs text-muted-foreground">Awaiting Collection</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="border-b px-4 pt-3">
                  <TabsList className="bg-transparent">
                    <TabsTrigger value="collections">Collections</TabsTrigger>
                    <TabsTrigger value="settlements">Settlement Advices</TabsTrigger>
                    <TabsTrigger value="waterfall">Waterfall</TabsTrigger>
                    <TabsTrigger value="awaiting">Awaiting Collection ({fundedInvoices.length})</TabsTrigger>
                    <TabsTrigger value="repayments">Repayments</TabsTrigger>
                    <TabsTrigger value="fee-alerts" className={feeAlertCount > 0 ? "text-destructive data-[state=active]:text-destructive" : ""}>
                      <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                      Fee Alerts{feeAlertCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] h-4 min-w-4 px-1">{feeAlertCount}</span>}
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Collections Tab */}
                <TabsContent value="collections" className="m-0">
                  {collections.length === 0 ? (
                    <div className="flex flex-col items-center py-12">
                      <Banknote className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No collections recorded yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice</TableHead>
                          <TableHead>Debtor</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {collections.map((col) => (
                          <TableRow key={col.id}>
                            <TableCell className="font-medium">
                              {(col.invoices as any)?.invoice_number || "—"}
                            </TableCell>
                            <TableCell>{col.debtor_name || "—"}</TableCell>
                            <TableCell>{col.currency} {Number(col.collected_amount).toLocaleString()}</TableCell>
                            <TableCell>{new Date(col.collection_date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{col.payment_reference || "—"}</TableCell>
                            <TableCell>{collectionStatusBadge(col.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* Settlement Advices Tab */}
                <TabsContent value="settlements" className="m-0">
                  {settlements.length === 0 ? (
                    <div className="flex flex-col items-center py-12">
                      <Receipt className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No settlement advices generated yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Advice #</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>Gross</TableHead>
                          <TableHead>Net</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settlements.map((sa) => (
                          <TableRow key={sa.id}>
                            <TableCell className="font-medium text-xs">{sa.advice_number}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {sa.advice_type === "borrower_settlement" ? "Borrower" : "Funder"}
                              </Badge>
                            </TableCell>
                            <TableCell>{sa.to_party_name}</TableCell>
                            <TableCell>{sa.currency} {Number(sa.gross_amount).toLocaleString()}</TableCell>
                            <TableCell className="font-medium">{sa.currency} {Number(sa.net_amount).toLocaleString()}</TableCell>
                            <TableCell>{settlementStatusBadge(sa.status)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" className="text-xs" onClick={() => setDetailAdvice(sa)}>
                                <FileText className="mr-1 h-3 w-3" /> View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* GAP-16/30: Settlement Waterfall Tab */}
                <TabsContent value="waterfall" className="m-0 p-4">
                  {settlements.length === 0 ? (
                    <div className="flex flex-col items-center py-12">
                      <ArrowRight className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No settlements yet — record a collection first</p>
                    </div>
                  ) : (() => {
                    // Compute waterfall: for each settlement, sum fee breakdown by party
                    const waterfallByInvoice = new Map<string, { invoice: string; collected: number; currency: string; funderPrincipal: number; funderYield: number; originatorMargin: number; borrowerNet: number; platformFee: number; }>();
                    
                    settlements.forEach((sa: any) => {
                      const invNum = (sa.invoices as any)?.invoice_number || sa.invoice_id?.slice(0,8) || "—";
                      const existing = waterfallByInvoice.get(invNum) || {
                        invoice: invNum,
                        collected: Number(sa.gross_amount || 0),
                        currency: sa.currency || "GBP",
                        funderPrincipal: 0, funderYield: 0, originatorMargin: 0, borrowerNet: 0, platformFee: 0,
                      };

                      if (sa.advice_type === "funder_settlement") {
                        // Funder gets principal + yield
                        const breakdown = (sa.fee_breakdown as any[]) || [];
                        breakdown.forEach((item: any) => {
                          if (item.type === "net") existing.funderPrincipal += Math.abs(item.amount || 0);
                          if (item.label?.toLowerCase().includes("yield") || item.label?.toLowerCase().includes("fee")) {
                            existing.funderYield += Math.abs(item.amount || 0);
                          }
                        });
                        if (existing.funderPrincipal === 0) existing.funderPrincipal = Number(sa.net_amount || 0);
                      } else {
                        // Borrower settlement
                        const breakdown = (sa.fee_breakdown as any[]) || [];
                        let origFee = 0, platFee = 0;
                        breakdown.forEach((item: any) => {
                          const lbl = (item.label || "").toLowerCase();
                          if (lbl.includes("originator")) origFee += Math.abs(item.amount || 0);
                          else if (lbl.includes("platform")) platFee += Math.abs(item.amount || 0);
                        });
                        existing.originatorMargin += origFee;
                        existing.platformFee += platFee;
                        existing.borrowerNet += Number(sa.net_amount || 0);
                      }

                      waterfallByInvoice.set(invNum, existing);
                    });

                    const waterfallRows = Array.from(waterfallByInvoice.values());
                    const totals = waterfallRows.reduce((t, r) => ({
                      collected: t.collected + r.collected,
                      funder: t.funder + r.funderPrincipal,
                      originator: t.originator + r.originatorMargin,
                      platform: t.platform + r.platformFee,
                      borrower: t.borrower + r.borrowerNet,
                    }), { collected: 0, funder: 0, originator: 0, platform: 0, borrower: 0 });

                    const cur = waterfallRows[0]?.currency || "GBP";
                    const fmt = (n: number) => `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

                    return (
                      <div className="space-y-4">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="rounded-lg border p-3 bg-blue-50/50 dark:bg-blue-900/10">
                            <p className="text-xs text-muted-foreground mb-1">Funder Returns</p>
                            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{fmt(totals.funder)}</p>
                          </div>
                          <div className="rounded-lg border p-3 bg-green-50/50 dark:bg-green-900/10">
                            <p className="text-xs text-muted-foreground mb-1">Originator Margin</p>
                            <p className="text-lg font-bold text-green-700 dark:text-green-300">{fmt(totals.originator)}</p>
                          </div>
                          <div className="rounded-lg border p-3 bg-purple-50/50 dark:bg-purple-900/10">
                            <p className="text-xs text-muted-foreground mb-1">Borrower Reimbursement</p>
                            <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{fmt(totals.borrower)}</p>
                          </div>
                          <div className="rounded-lg border p-3 bg-amber-50/50 dark:bg-amber-900/10">
                            <p className="text-xs text-muted-foreground mb-1">Total Collected</p>
                            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(totals.collected)}</p>
                          </div>
                        </div>

                        {/* Waterfall Table */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invoice</TableHead>
                              <TableHead className="text-right">Collected</TableHead>
                              <TableHead className="text-right text-blue-600">→ Funder</TableHead>
                              <TableHead className="text-right text-green-600">→ Originator</TableHead>
                              <TableHead className="text-right text-purple-600">→ Borrower</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {waterfallRows.map((row, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{row.invoice}</TableCell>
                                <TableCell className="text-right">{fmt(row.collected)}</TableCell>
                                <TableCell className="text-right text-blue-600 font-medium">{fmt(row.funderPrincipal)}</TableCell>
                                <TableCell className="text-right text-green-600 font-medium">{fmt(row.originatorMargin)}</TableCell>
                                <TableCell className="text-right text-purple-600 font-medium">{fmt(row.borrowerNet)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/50 font-bold">
                              <TableCell>TOTAL</TableCell>
                              <TableCell className="text-right">{fmt(totals.collected)}</TableCell>
                              <TableCell className="text-right text-blue-600">{fmt(totals.funder)}</TableCell>
                              <TableCell className="text-right text-green-600">{fmt(totals.originator)}</TableCell>
                              <TableCell className="text-right text-purple-600">{fmt(totals.borrower)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* Awaiting Collection Tab */}
                <TabsContent value="awaiting" className="m-0">
                  {fundedInvoices.length === 0 ? (
                    <div className="flex flex-col items-center py-12">
                      <CheckCircle2 className="h-10 w-10 text-primary mb-3" />
                      <p className="text-sm text-muted-foreground">No invoices awaiting collection</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Borrower</TableHead>
                          <TableHead>Debtor</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fundedInvoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                            <TableCell>{(inv.borrowers as any)?.company_name || "—"}</TableCell>
                            <TableCell>{inv.debtor_name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {PRODUCT_LABELS[inv.product_type] || inv.product_type}
                              </Badge>
                            </TableCell>
                            <TableCell>{inv.currency} {Number(inv.amount).toLocaleString()}</TableCell>
                            <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Button size="sm" onClick={() => openCollectDialog(inv)}>
                                <Banknote className="mr-1 h-3 w-3" /> Record Payment
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* Repayments Tab */}
                <TabsContent value="repayments" className="m-0 p-4">
                  <RepaymentsContent />
                </TabsContent>

                {/* Fee Alerts Tab */}
                <TabsContent value="fee-alerts" className="m-0 p-4">
                  <FeeResolutionPanel
                    orgId={profile!.organization_id!}
                    onResolved={() => { fetchData(); setActiveTab("settlements"); }}
                    navigate={navigate}
                  />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Record Collection Dialog */}
      <Dialog open={collectDialogOpen} onOpenChange={setCollectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Debtor Payment</DialogTitle>
            <DialogDescription>
              Record payment received from {selectedInvoice?.debtor_name} for invoice {selectedInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice Amount</span>
                <span className="font-medium">{selectedInvoice?.currency} {Number(selectedInvoice?.amount || 0).toLocaleString()}</span>
              </div>
              {Number(selectedInvoice?.accrued_late_fees || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Accrued Late Fees</span>
                  <span className="font-medium text-destructive">+ {selectedInvoice?.currency} {Number(selectedInvoice?.accrued_late_fees).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t pt-1 mt-1">
                <span className="text-muted-foreground font-medium">Expected Total</span>
                <span className="font-bold">{selectedInvoice?.currency} {(Number(selectedInvoice?.amount || 0) + Number(selectedInvoice?.accrued_late_fees || 0)).toLocaleString()}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Collected Amount *</Label>
              <Input
                type="number"
                value={collectedAmount}
                onChange={(e) => setCollectedAmount(e.target.value)}
                placeholder="Amount received"
              />
              {collectedAmount && selectedInvoice && (() => {
                const expected = Number(selectedInvoice.amount) + Number(selectedInvoice.accrued_late_fees || 0);
                const collected = parseFloat(collectedAmount);
                if (!isNaN(collected) && Math.abs(collected - expected) > 0.01) {
                  return (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        Collected amount does not match expected total ({selectedInvoice.currency} {expected.toLocaleString()}).
                        Difference: {selectedInvoice.currency} {Math.abs(collected - expected).toLocaleString()}.
                        This may indicate a partial payment or shortfall.
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div className="space-y-2">
              <Label>Collection Date *</Label>
              <Input
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Reference</Label>
              <Input
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="Bank reference or transaction ID"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={collectionNotes}
                onChange={(e) => setCollectionNotes(e.target.value)}
                rows={2}
                placeholder="Any additional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordCollection} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record & Generate Settlements
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settlement Advice Detail Dialog */}
      <Dialog open={!!detailAdvice} onOpenChange={() => setDetailAdvice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Settlement Advice
            </DialogTitle>
            <DialogDescription>{detailAdvice?.advice_number}</DialogDescription>
          </DialogHeader>
          {detailAdvice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">From</span>
                  <p className="font-medium">{detailAdvice.from_party_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">To</span>
                  <p className="font-medium">{detailAdvice.to_party_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium capitalize">
                    {detailAdvice.advice_type === "borrower_settlement" ? "Borrower Settlement" : "Funder Settlement"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Product</span>
                  <p className="font-medium">{PRODUCT_LABELS[detailAdvice.product_type] || detailAdvice.product_type}</p>
                </div>
              </div>

              <Separator />

              {/* Fee breakdown */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Fee Breakdown</h4>
                <div className="rounded-lg border">
                  {(detailAdvice.fee_breakdown as any[])?.map((item: any, i: number) => (
                    <div
                      key={i}
                      className={`flex justify-between px-4 py-2 text-sm ${
                        item.type === "net" ? "font-bold border-t bg-muted/50" : ""
                      }`}
                    >
                      <span className={item.type === "net" ? "text-foreground" : "text-muted-foreground"}>
                        {item.label}
                      </span>
                      <span className={item.amount < 0 ? "text-destructive" : "text-foreground"}>
                        {detailAdvice.currency} {Math.abs(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment instructions */}
              {detailAdvice.payment_instructions && Object.keys(detailAdvice.payment_instructions).length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Payment Instructions</h4>
                    <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                      {Object.entries(detailAdvice.payment_instructions).map(([key, val]) => (
                        <div key={key} className="flex justify-between py-1">
                          <span className="capitalize">{key.replace(/_/g, " ")}</span>
                          <span className="font-medium text-foreground">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Issued: {detailAdvice.issued_at ? new Date(detailAdvice.issued_at).toLocaleString() : "—"}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ─── Fee Resolution Panel ─────────────────────────────────────────────────────

function FeeResolutionPanel({
  orgId,
  onResolved,
  navigate,
}: {
  orgId: string;
  onResolved: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveOpen, setResolveOpen] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rates, setRates] = useState({
    originator_fee_pct: "2.00",
    discount_rate: "5.00",
    platform_fee_pct: "0.50",
    broker_fee_pct: "0.00",
  });

  const fetchTasks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fee_resolution_tasks" as any)
      .select(`
        *,
        invoices(invoice_number, amount, currency, product_type),
        borrowers(company_name)
      `)
      .eq("organization_id", orgId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setTasks(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [orgId]);

  const openResolve = (task: any) => {
    setRates({
      originator_fee_pct: "2.00",
      discount_rate: "5.00",
      platform_fee_pct: "0.50",
      broker_fee_pct: "0.00",
    });
    setResolveOpen(task);
  };

  const handleManualOverride = async () => {
    if (!resolveOpen) return;
    const origFee = parseFloat(rates.originator_fee_pct);
    const discRate = parseFloat(rates.discount_rate);
    if (isNaN(origFee) || isNaN(discRate) || origFee < 0 || discRate < 0) {
      toast.error("Please enter valid fee rates (must be ≥ 0)");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("generate-settlement", {
      body: {
        collection_id: resolveOpen.collection_id,
        resolve_task_id: resolveOpen.id,
        fee_override: {
          originator_fee_pct: origFee,
          discount_rate: discRate,
          platform_fee_pct: parseFloat(rates.platform_fee_pct) || 0.5,
          broker_fee_pct: parseFloat(rates.broker_fee_pct) || 0,
        },
      },
    });
    setSubmitting(false);

    if (error || data?.error) {
      toast.error(`Settlement failed: ${data?.message || error?.message || "Unknown error"}`);
    } else {
      toast.success("Settlement advice created using manual rate override");
      setResolveOpen(null);
      onResolved();
    }
  };

  const handleDismiss = async (task: any) => {
    await supabase
      .from("fee_resolution_tasks" as any)
      .update({ status: "dismissed", resolution_type: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", task.id);
    toast.info("Task dismissed");
    fetchTasks();
    onResolved();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-sm font-medium">No pending fee resolution tasks</p>
        <p className="text-xs text-muted-foreground">All settlement fees have been resolved.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-destructive">Fee Resolution Required</p>
          <p className="text-xs text-muted-foreground mt-1">
            The following collections could not generate settlement advices because no valid fee configuration was found.
            You can enter rates manually to proceed immediately, or update the borrower's facility / offer letter and retry.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {tasks.map((task) => (
          <div key={task.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">
                    {task.invoices?.invoice_number || "Invoice"} — {task.borrowers?.company_name || "Borrower"}
                  </p>
                  <Badge variant="destructive" className="text-[10px]">Fee Missing</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Product: {task.product_type?.replace(/_/g, " ")} &middot; Collection:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {task.currency} {Number(task.collection_amount || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Raised: {new Date(task.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => navigate(`/originator/borrowers/${task.borrower_id}`)}
                >
                  <ExternalLink className="h-3 w-3" />Update Facility
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs"
                  onClick={() => {
                    // Retry without override — lets the chain re-run after facility update
                    setSubmitting(true);
                    supabase.functions.invoke("generate-settlement", {
                      body: { collection_id: task.collection_id, resolve_task_id: task.id },
                    }).then(({ data, error }) => {
                      setSubmitting(false);
                      if (error || data?.error) {
                        toast.error(data?.failure_reason || data?.message || "Retry failed — fee still not found");
                      } else {
                        toast.success("Settlement created on retry");
                        onResolved();
                      }
                    });
                  }}
                  disabled={submitting}
                >
                  <RefreshCw className="h-3 w-3" />Retry
                </Button>
                <Button size="sm" onClick={() => openResolve(task)} className="gap-1 text-xs">
                  Enter Rates
                </Button>
              </div>
            </div>

            {task.failure_reason && (
              <div className="rounded-md bg-muted/50 border border-muted px-3 py-2">
                <p className="text-[11px] text-muted-foreground leading-relaxed">{task.failure_reason}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Manual Rate Override Dialog */}
      <Dialog open={!!resolveOpen} onOpenChange={(o) => !o && setResolveOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Manual Fee Override
            </DialogTitle>
            <DialogDescription>
              Enter the rates to apply to this settlement. These will be recorded as a manual override
              for audit purposes and the settlement advice will be created immediately.
            </DialogDescription>
          </DialogHeader>

          {resolveOpen && (
            <div className="space-y-4">
              {/* Context */}
              <div className="rounded-lg bg-muted/40 border px-3 py-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-medium">{resolveOpen.invoices?.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Borrower</span>
                  <span className="font-medium">{resolveOpen.borrowers?.company_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Collection</span>
                  <span className="font-mono font-medium">
                    {resolveOpen.currency} {Number(resolveOpen.collection_amount || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Product</span>
                  <span>{resolveOpen.product_type?.replace(/_/g, " ")}</span>
                </div>
              </div>

              <Separator />

              {/* Rate fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">
                    Discount Rate % <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-[10px] text-muted-foreground mb-1">Annual rate applied to collection</p>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    max="100"
                    value={rates.discount_rate}
                    onChange={(e) => setRates((r) => ({ ...r, discount_rate: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">
                    Originator Fee % <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-[10px] text-muted-foreground mb-1">Platform originator margin</p>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    max="100"
                    value={rates.originator_fee_pct}
                    onChange={(e) => setRates((r) => ({ ...r, originator_fee_pct: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Platform Fee %</Label>
                  <p className="text-[10px] text-muted-foreground mb-1">Vybrel platform fee</p>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={rates.platform_fee_pct}
                    onChange={(e) => setRates((r) => ({ ...r, platform_fee_pct: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Broker Fee %</Label>
                  <p className="text-[10px] text-muted-foreground mb-1">0 if no broker involved</p>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={rates.broker_fee_pct}
                    onChange={(e) => setRates((r) => ({ ...r, broker_fee_pct: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Live preview */}
              {(() => {
                const gross = Number(resolveOpen.collection_amount || 0);
                const disc = (gross * (parseFloat(rates.discount_rate) || 0)) / 100;
                const origFee = (gross * (parseFloat(rates.originator_fee_pct) || 0)) / 100;
                const platFee = (gross * (parseFloat(rates.platform_fee_pct) || 0)) / 100;
                const brokFee = (gross * (parseFloat(rates.broker_fee_pct) || 0)) / 100;
                const net = gross - disc - origFee - platFee - brokFee;
                const fmt = (n: number) =>
                  `${resolveOpen.currency} ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                return (
                  <div className="rounded-lg border divide-y text-sm mt-1">
                    <div className="flex justify-between px-3 py-1.5 text-muted-foreground text-xs">
                      <span>Gross Collection</span><span className="font-mono">{fmt(gross)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-1.5 text-muted-foreground text-xs">
                      <span>Discount ({rates.discount_rate}%)</span><span className="font-mono">−{fmt(disc)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-1.5 text-muted-foreground text-xs">
                      <span>Originator Fee ({rates.originator_fee_pct}%)</span><span className="font-mono">−{fmt(origFee)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-1.5 text-muted-foreground text-xs">
                      <span>Platform Fee ({rates.platform_fee_pct}%)</span><span className="font-mono">−{fmt(platFee)}</span>
                    </div>
                    {brokFee > 0 && (
                      <div className="flex justify-between px-3 py-1.5 text-muted-foreground text-xs">
                        <span>Broker Fee ({rates.broker_fee_pct}%)</span><span className="font-mono">−{fmt(brokFee)}</span>
                      </div>
                    )}
                    <div className={`flex justify-between px-3 py-2 font-semibold text-xs ${net < 0 ? "text-destructive bg-destructive/5" : "text-foreground bg-muted/30"}`}>
                      <span>Net to Borrower</span><span className="font-mono">{fmt(net)}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-[11px] text-amber-700">
                This override will be recorded in the audit log as a manual rate entry by you. Ensure these rates have been authorised by a credit manager before proceeding.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => resolveOpen && handleDismiss(resolveOpen)}>
              Dismiss Task
            </Button>
            <Button variant="outline" onClick={() => setResolveOpen(null)}>Cancel</Button>
            <Button onClick={handleManualOverride} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create Settlement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
