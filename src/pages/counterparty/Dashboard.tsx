import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileCheck, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Inbox, ShieldCheck, FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const PRODUCT_LABELS: Record<string, string> = {
  receivables_purchase: "Receivables Purchase",
  reverse_factoring: "Reverse Factoring",
  payables_finance: "Payables Finance",
};

export default function CounterpartyDashboard() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  useEffect(() => {
    if (user) fetchInvoices();
  }, [user]);

  const fetchInvoices = async () => {
    setLoading(true);

    // Fetch invoices where user's email is the counterparty
    const { data, error } = await supabase
      .from("invoices")
      .select("*, borrowers(company_name)")
      .eq("requires_counterparty_acceptance", true)
      .eq("counterparty_email", user!.email)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching counterparty invoices:", error);
      toast.error("Failed to load invoices");
    }

    setInvoices(data || []);
    setLoading(false);
  };

  const handleAction = async (invoiceId: string, status: "accepted" | "rejected") => {
    setSubmitting(true);

    // Find the invoice to get its token
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) {
      toast.error("Invoice not found");
      setSubmitting(false);
      return;
    }

    const { data, error } = await supabase.rpc("accept_invoice_by_token", {
      _token: invoice.acceptance_token,
      _email: user!.email!,
      _status: status,
      _notes: notes || null,
    });

    if (error || !data) {
      toast.error("Failed to process invoice. It may have already been handled.");
    } else {
      toast.success(status === "accepted" ? "Invoice accepted!" : "Invoice rejected");
      setSelectedInvoice(null);
      setNotes("");
      fetchInvoices();
    }
    setSubmitting(false);
  };

  const pendingInvoices = invoices.filter((i) => i.acceptance_status === "pending");
  const processedInvoices = invoices.filter((i) => i.acceptance_status !== "pending");

  const statusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge variant="default" className="text-xs"><CheckCircle2 className="mr-1 h-3 w-3" />Accepted</Badge>;
      case "accepted_via_document":
        return <Badge variant="default" className="text-xs"><FileText className="mr-1 h-3 w-3" />Doc Accepted</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-xs"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-xs"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
  };

  const InvoiceTable = ({ items, showActions }: { items: any[]; showActions: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice #</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead>Product</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead>
          {showActions && <TableHead className="text-right">Action</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((inv) => (
          <TableRow key={inv.id}>
            <TableCell className="font-medium">{inv.invoice_number}</TableCell>
            <TableCell>{(inv.borrowers as any)?.company_name || "—"}</TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {PRODUCT_LABELS[inv.product_type] || inv.product_type}
              </Badge>
            </TableCell>
            <TableCell>{inv.currency} {Number(inv.amount).toLocaleString()}</TableCell>
            <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
            <TableCell>{statusBadge(inv.acceptance_status)}</TableCell>
            {showActions && (
              <TableCell className="text-right">
                <Button size="sm" onClick={() => setSelectedInvoice(inv)}>
                  Review
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoice Verification</h1>
          <p className="text-sm text-muted-foreground">
            Review and verify invoices submitted by suppliers
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingInvoices.length}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {processedInvoices.filter((i) => i.acceptance_status === "accepted" || i.acceptance_status === "accepted_via_document").length}
                </p>
                <p className="text-xs text-muted-foreground">Accepted</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {processedInvoices.filter((i) => i.acceptance_status === "rejected").length}
                </p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium text-foreground">No invoices to review</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Invoices requiring your verification will appear here
                </p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="border-b px-4 pt-3">
                  <TabsList className="bg-transparent">
                    <TabsTrigger value="pending" className="data-[state=active]:bg-primary/10">
                      Pending ({pendingInvoices.length})
                    </TabsTrigger>
                    <TabsTrigger value="processed" className="data-[state=active]:bg-primary/10">
                      Processed ({processedInvoices.length})
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="pending" className="m-0">
                  {pendingInvoices.length === 0 ? (
                    <div className="flex flex-col items-center py-12">
                      <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
                      <p className="text-sm text-muted-foreground">All caught up! No pending invoices.</p>
                    </div>
                  ) : (
                    <InvoiceTable items={pendingInvoices} showActions={true} />
                  )}
                </TabsContent>
                <TabsContent value="processed" className="m-0">
                  {processedInvoices.length === 0 ? (
                    <div className="flex flex-col items-center py-12">
                      <FileCheck className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No processed invoices yet.</p>
                    </div>
                  ) : (
                    <InvoiceTable items={processedInvoices} showActions={false} />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => { setSelectedInvoice(null); setNotes(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Review Invoice
            </DialogTitle>
            <DialogDescription>
              Review the invoice details and accept or reject
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{selectedInvoice.invoice_number}</span>
                  <Badge variant="outline" className="text-xs">
                    {PRODUCT_LABELS[selectedInvoice.product_type] || selectedInvoice.product_type}
                  </Badge>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Supplier</span>
                    <p className="font-medium">{(selectedInvoice.borrowers as any)?.company_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Debtor</span>
                    <p className="font-medium">{selectedInvoice.debtor_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount</span>
                    <p className="font-medium">{selectedInvoice.currency} {Number(selectedInvoice.amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Due Date</span>
                    <p className="font-medium">{new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Issue Date</span>
                    <p className="font-medium">{new Date(selectedInvoice.issue_date).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any comments about this invoice..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => handleAction(selectedInvoice.id, "rejected")}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button
              onClick={() => handleAction(selectedInvoice.id, "accepted")}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Accept Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
