import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Plus, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function BorrowerInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [borrower, setBorrower] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [debtorName, setDebtorName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const { data: b } = await supabase
      .from("borrowers")
      .select("id, organization_id, company_name")
      .eq("user_id", user!.id)
      .single();

    if (!b) { setLoading(false); return; }
    setBorrower(b);

    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("borrower_id", b.id)
      .order("created_at", { ascending: false });

    setInvoices(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!borrower || !invoiceNumber || !debtorName || !amount || !issueDate || !dueDate) {
      toast.error("Please fill all required fields");
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from("invoices").insert({
      organization_id: borrower.organization_id,
      borrower_id: borrower.id,
      invoice_number: invoiceNumber,
      debtor_name: debtorName,
      amount: parseFloat(amount),
      currency,
      issue_date: issueDate,
      due_date: dueDate,
      status: "pending",
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Invoice submitted successfully");
      setDialogOpen(false);
      resetForm();
      fetchData();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setInvoiceNumber("");
    setDebtorName("");
    setAmount("");
    setCurrency("USD");
    setIssueDate("");
    setDueDate("");
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": return "default";
      case "funded": return "default";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Invoices</h1>
            <p className="text-sm text-muted-foreground">Submit invoices for financing</p>
          </div>
          <Button onClick={() => setDialogOpen(true)} disabled={!borrower}>
            <Plus className="mr-2 h-4 w-4" /> Submit Invoice
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : invoices.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No invoices submitted yet</p>
                <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Submit Your First Invoice
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Debtor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{inv.debtor_name}</TableCell>
                      <TableCell>{inv.currency} {Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell>{new Date(inv.issue_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(inv.status) as any} className="capitalize text-xs">
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Number *</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-001" />
              </div>
              <div className="space-y-2">
                <Label>Debtor Name *</Label>
                <Input value={debtorName} onChange={(e) => setDebtorName(e.target.value)} placeholder="Company Ltd" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000" />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Date *</Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
