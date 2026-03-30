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
  Download, ArrowRight, Receipt
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const PRODUCT_LABELS: Record<string, string> = {
  receivables_purchase: "Receivables Purchase",
  reverse_factoring: "Reverse Factoring",
  payables_finance: "Payables Finance",
};

export default function Collections() {
  const { user, profile } = useAuth();
  const [collections, setCollections] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [fundedInvoices, setFundedInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("collections");

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
        .select("*, borrowers(company_name)")
        .eq("organization_id", orgId)
        .in("status", ["funded", "approved"])
        .order("due_date", { ascending: true }),
    ]);

    setCollections(colRes.data || []);
    setSettlements(settRes.data || []);
    setFundedInvoices(invRes.data || []);
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
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice Amount</span>
                <span className="font-medium">{selectedInvoice?.currency} {Number(selectedInvoice?.amount || 0).toLocaleString()}</span>
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
