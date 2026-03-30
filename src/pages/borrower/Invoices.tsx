import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Plus, Loader2, FileText, Upload, CheckCircle2, Clock } from "lucide-react";
import { InvoiceSubmissionWizard } from "@/components/invoice-submission/InvoiceSubmissionWizard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const PRODUCT_TYPES = [
  { value: "receivables_purchase", label: "Receivables Purchase", desc: "Sell your receivables — counterparty verifies the invoice" },
  { value: "reverse_factoring", label: "Reverse Factoring", desc: "Buyer-initiated — counterparty confirms payable invoices" },
  { value: "payables_finance", label: "Payables Finance", desc: "Counterparty confirms payables for early supplier payment" },
];

export default function BorrowerInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [borrower, setBorrower] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadDialogInvoice, setUploadDialogInvoice] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // Form
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [debtorName, setDebtorName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [productType, setProductType] = useState("receivables_purchase");
  const [requiresAcceptance, setRequiresAcceptance] = useState(true);
  const [counterpartyEmail, setCounterpartyEmail] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");

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
    if (requiresAcceptance && !counterpartyEmail) {
      toast.error("Counterparty email is required when acceptance is needed");
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
      product_type: productType,
      requires_counterparty_acceptance: requiresAcceptance,
      counterparty_email: requiresAcceptance ? counterpartyEmail : null,
      counterparty_name: requiresAcceptance ? counterpartyName : null,
      acceptance_status: requiresAcceptance ? "pending" : "accepted",
    } as any);

    if (error) toast.error(error.message);
    else {
      toast.success("Invoice submitted successfully");
      setDialogOpen(false);
      resetForm();
      fetchData();

      // Trigger counterparty notification if acceptance is required
      if (requiresAcceptance && counterpartyEmail) {
        // Fetch the newly created invoice to get its ID
        const { data: newInv } = await supabase
          .from("invoices")
          .select("id")
          .eq("borrower_id", borrower.id)
          .eq("invoice_number", invoiceNumber || "")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (newInv) {
          supabase.functions.invoke("notify-counterparty", {
            body: { invoice_id: newInv.id },
          }).then(({ error: notifyErr }) => {
            if (notifyErr) {
              console.error("Failed to send counterparty notification:", notifyErr);
            } else {
              toast.success("Verification link sent to counterparty");
            }
          });
        }
      }
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setInvoiceNumber(""); setDebtorName(""); setAmount(""); setCurrency("USD");
    setIssueDate(""); setDueDate(""); setProductType("receivables_purchase");
    setRequiresAcceptance(true); setCounterpartyEmail(""); setCounterpartyName("");
  };

  const handleUploadAcceptanceDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadDialogInvoice || !borrower) return;
    setUploading(true);

    // Upload file to storage
    const filePath = `${borrower.organization_id}/${uploadDialogInvoice.id}/acceptance-${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Failed to upload file: " + uploadError.message);
      setUploading(false);
      return;
    }

    // Create document record
    const { data: doc, error: docError } = await supabase.from("documents").insert({
      organization_id: borrower.organization_id,
      borrower_id: borrower.id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      document_type: "other" as any,
      uploaded_by: user!.id,
      metadata: { purpose: "counterparty_acceptance", invoice_id: uploadDialogInvoice.id },
    }).select("id").single();

    if (docError) {
      toast.error("Failed to create document record");
      setUploading(false);
      return;
    }

    // Create acceptance record — status goes to pending_document_review for Ops Manager
    const { error: accError } = await supabase.from("invoice_acceptances" as any).insert({
      invoice_id: uploadDialogInvoice.id,
      organization_id: borrower.organization_id,
      method: "document_upload",
      status: "pending_document_review",
      accepted_by_user_id: user!.id,
      accepted_by_email: user!.email,
      document_id: doc!.id,
      notes: `Acceptance document uploaded by borrower: ${file.name}. Awaiting Ops Manager review.`,
    });

    if (accError) {
      toast.error("Failed to record acceptance");
      setUploading(false);
      return;
    }

    // Update invoice acceptance status to pending_document_review
    await supabase.from("invoices")
      .update({ acceptance_status: "pending_document_review" } as any)
      .eq("id", uploadDialogInvoice.id);

    toast.success("Acceptance document uploaded — awaiting Operations Manager review before invoice can be funded");
    setUploadDialogInvoice(null);
    setUploading(false);
    fetchData();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": case "funded": return "default";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  const acceptanceStatusBadge = (inv: any) => {
    if (!inv.requires_counterparty_acceptance) return null;
    const s = inv.acceptance_status;
    switch (s) {
      case "accepted": return <Badge variant="default" className="text-xs">Accepted</Badge>;
      case "accepted_via_document": return <Badge variant="default" className="text-xs">Doc Accepted</Badge>;
      case "rejected": return <Badge variant="destructive" className="text-xs">CP Rejected</Badge>;
      default: return <Badge variant="outline" className="text-xs"><Clock className="mr-1 h-3 w-3" />Awaiting CP</Badge>;
    }
  };

  const productLabel = (type: string) => PRODUCT_TYPES.find(p => p.value === type)?.label || type;

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
            ) : !borrower ? (
              <div className="flex flex-col items-center py-12">
                <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No borrower profile is linked to your account.</p>
                <p className="text-xs text-muted-foreground mt-1">Please contact your administrator to set up your borrower profile.</p>
              </div>
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
                    <TableHead>Product</TableHead>
                    <TableHead>Debtor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Acceptance</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {productLabel(inv.product_type || "receivables_purchase")}
                        </Badge>
                      </TableCell>
                      <TableCell>{inv.debtor_name}</TableCell>
                      <TableCell>{inv.currency} {Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(inv.status) as any} className="capitalize text-xs">
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{acceptanceStatusBadge(inv)}</TableCell>
                      <TableCell>
                        {inv.requires_counterparty_acceptance && inv.acceptance_status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => setUploadDialogInvoice(inv)}
                          >
                            <Upload className="mr-1 h-3 w-3" /> Upload Acceptance
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>


      {/* Invoice Submission Wizard */}
      {borrower && (
        <InvoiceSubmissionWizard
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          borrower={borrower}
          userId={user!.id}
          onSubmitted={fetchData}
        />
      )}

      {/* Upload Acceptance Document Dialog */}
      <Dialog open={!!uploadDialogInvoice} onOpenChange={() => setUploadDialogInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Acceptance Document</DialogTitle>
            <DialogDescription>
              Upload a signed acceptance document from the counterparty for invoice {uploadDialogInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border-2 border-dashed p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                Upload the signed acceptance letter or confirmation document
              </p>
              <label>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleUploadAcceptanceDoc}
                  disabled={uploading}
                />
                <Button variant="outline" asChild disabled={uploading}>
                  <span>
                    {uploading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                    ) : (
                      <><Upload className="mr-2 h-4 w-4" /> Choose File</>
                    )}
                  </span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-2">PDF, JPG, PNG, DOC — max 10MB</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
