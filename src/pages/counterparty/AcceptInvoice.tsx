import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, FileCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface InvoiceDetails {
  id: string;
  invoice_number: string;
  debtor_name: string;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  acceptance_status: string;
  counterparty_name: string | null;
  product_type: string;
  borrowers: { company_name: string } | null;
}

export default function AcceptInvoice() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [completed, setCompleted] = useState(false);
  const [resultStatus, setResultStatus] = useState<"accepted" | "rejected" | null>(null);

  useEffect(() => {
    if (token) fetchInvoice();
    else setLoading(false);
  }, [token]);

  const fetchInvoice = async () => {
    // Use an edge function to fetch invoice details by token securely
    const { data, error } = await supabase.functions.invoke("counterparty-verify", {
      body: { action: "get_invoice", token },
    });

    if (error || !data?.invoice) {
      setInvoice(null);
    } else {
      setInvoice(data.invoice);
    }
    setLoading(false);
  };

  const handleAction = async (status: "accepted" | "rejected") => {
    if (!email) {
      toast.error("Please enter your email to confirm your identity");
      return;
    }
    setSubmitting(true);

    const { data, error } = await supabase.rpc("accept_invoice_by_token", {
      _token: token!,
      _email: email,
      _status: status,
      _notes: notes || null,
    });

    if (error || !data) {
      toast.error("Failed to process. The link may be expired or already used.");
    } else {
      setCompleted(true);
      setResultStatus(status);
      toast.success(status === "accepted" ? "Invoice accepted!" : "Invoice rejected");
    }
    setSubmitting(false);
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold text-foreground">Invalid Link</h2>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              This verification link is missing or invalid. Please check the link in your email.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            {resultStatus === "accepted" ? (
              <>
                <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                <h2 className="text-xl font-semibold text-foreground">Invoice Accepted</h2>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  You have confirmed this invoice. The originator will be notified.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-xl font-semibold text-foreground">Invoice Rejected</h2>
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  You have rejected this invoice. The originator will be notified.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold text-foreground">Invoice Not Found</h2>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              This invoice may have already been processed, or the link has expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const productLabel = {
    receivables_purchase: "Receivables Purchase",
    reverse_factoring: "Reverse Factoring",
    payables_finance: "Payables Finance",
  }[invoice.product_type] || invoice.product_type;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <FileCheck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Invoice Verification Request</CardTitle>
          <CardDescription>
            You've been asked to verify the following invoice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invoice details */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{invoice.invoice_number}</span>
              <Badge variant="outline" className="text-xs">{productLabel}</Badge>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Supplier:</span>
                <p className="font-medium text-foreground">{(invoice.borrowers as any)?.company_name || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Debtor:</span>
                <p className="font-medium text-foreground">{invoice.debtor_name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Amount:</span>
                <p className="font-medium text-foreground">{invoice.currency} {Number(invoice.amount).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Due Date:</span>
                <p className="font-medium text-foreground">{new Date(invoice.due_date).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Confirmation form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Email *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@company.com"
              />
              <p className="text-xs text-muted-foreground">
                Used to verify your identity as the counterparty
              </p>
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

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
              onClick={() => handleAction("rejected")}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleAction("accepted")}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Accept Invoice
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Secured by Vybrel Invoice Financing Platform</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
