import { useState, useCallback, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload, Loader2, FileText, AlertTriangle, AlertCircle, Info, CheckCircle2,
  X, ChevronRight, ChevronLeft, PackageCheck, Send, Sparkles, File
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PRODUCT_TYPES = [
  { value: "receivables_purchase", label: "Receivables Purchase", desc: "Sell your receivables" },
  { value: "reverse_factoring", label: "Reverse Factoring", desc: "Buyer-initiated" },
  { value: "payables_finance", label: "Payables Finance", desc: "Early supplier payment" },
];

const DOC_TAG_LABELS: Record<string, string> = {
  invoice: "Invoice",
  proof_of_delivery: "Proof of Delivery",
  packaging_slip: "Packaging Slip",
  sales_quote: "Sales Quote",
  purchase_order: "Purchase Order",
  banking_note: "Banking Note",
  buyer_email: "Buyer Email",
  contract: "Contract",
  credit_note: "Credit Note",
  statement_of_account: "Statement",
  bill_of_lading: "Bill of Lading",
  insurance_certificate: "Insurance Cert.",
  other: "Other",
};

interface InvoiceSubmissionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrower: { id: string; organization_id: string; company_name: string };
  userId: string;
  onSubmitted: () => void;
}

type Step = "upload" | "analysis" | "review";

interface UploadedDoc {
  file: File;
  document_id?: string;
  file_path?: string;
  uploading?: boolean;
  uploaded?: boolean;
}

export function InvoiceSubmissionWizard({ open, onOpenChange, borrower, userId, onSubmitted }: InvoiceSubmissionWizardProps) {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<UploadedDoc[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [approvedFacilities, setApprovedFacilities] = useState<any[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);


  // AI analysis results
  const [docClassifications, setDocClassifications] = useState<any[]>([]);
  const [extractedData, setExtractedData] = useState<any>({});
  const [observations, setObservations] = useState<any[]>([]);
  const [missingDocs, setMissingDocs] = useState<string[]>([]);
  const [summary, setSummary] = useState("");

  // Editable form fields (populated by AI)
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerTaxId, setBuyerTaxId] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerTaxId, setSellerTaxId] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [productType, setProductType] = useState("receivables_purchase");
  const [requiresAcceptance, setRequiresAcceptance] = useState(true);
  const [counterpartyEmail, setCounterpartyEmail] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");

  // Comments
  const [observationComments, setObservationComments] = useState<Record<number, string>>({});
  const [documentComments, setDocumentComments] = useState<Record<number, string>>({});
  const [overallComment, setOverallComment] = useState("");

  // Load approved facilities when wizard opens
  const loadFacilities = useCallback(async () => {
    const { data } = await supabase
      .from("facility_requests")
      .select("*")
      .eq("borrower_id", borrower.id)
      .eq("status", "approved")
      .order("created_at");
    setApprovedFacilities(data || []);
  }, [borrower.id]);

  // Load on open
  useEffect(() => { if (open) loadFacilities(); }, [open, loadFacilities]);

  const resetWizard = () => {
    setStep("upload");
    setFiles([]);
    setAnalyzing(false);
    setDocClassifications([]);
    setExtractedData({});
    setObservations([]);
    setMissingDocs([]);
    setSummary("");
    setInvoiceNumber(""); setInvoiceDate(""); setDueDate("");
    setBuyerName(""); setBuyerAddress(""); setBuyerTaxId("");
    setSellerName(""); setSellerAddress(""); setSellerTaxId("");
    setSubtotal(""); setTaxAmount(""); setTotalAmount("");
    setCurrency("USD"); setLineItems([]);
    setProductType("receivables_purchase");
    setRequiresAcceptance(true); setCounterpartyEmail(""); setCounterpartyName("");
    setObservationComments({}); setDocumentComments({}); setOverallComment("");
    setSelectedFacilityId("");
    setEligibilityError(null);
  };

  const handleClose = (val: boolean) => {
    if (!val) resetWizard();
    else loadFacilities();
    onOpenChange(val);
  };

  const addFiles = (newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).map(f => ({ file: f }));
    setFiles(prev => [...prev, ...arr]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, []);

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const uploadAndAnalyze = async () => {
    if (files.length === 0) { toast.error("Please upload at least one document"); return; }
    setAnalyzing(true);

    try {
      // Upload all files to storage
      const uploadedDocs: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const filePath = `${borrower.organization_id}/${borrower.id}/submissions/${Date.now()}-${f.file.name}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(filePath, f.file);
        if (upErr) throw new Error(`Failed to upload ${f.file.name}: ${upErr.message}`);

        const { data: doc, error: docErr } = await supabase.from("documents").insert({
          organization_id: borrower.organization_id,
          borrower_id: borrower.id,
          file_name: f.file.name,
          file_path: filePath,
          file_size: f.file.size,
          mime_type: f.file.type,
          document_type: "other" as any,
          uploaded_by: userId,
        }).select("id").single();

        if (docErr) throw new Error(`Failed to save ${f.file.name}: ${docErr.message}`);
        uploadedDocs.push({ document_id: doc!.id, file_name: f.file.name, file_path: filePath, mime_type: f.file.type, file_size: f.file.size });

        setFiles(prev => prev.map((pf, pi) => pi === i ? { ...pf, document_id: doc!.id, file_path: filePath, uploaded: true } : pf));
      }

      // Call AI analysis
      const { data, error } = await supabase.functions.invoke("ai-analyze-invoice-docs", {
        body: { documents: uploadedDocs },
      });

      if (error) throw new Error(error.message || "AI analysis failed");

      const analysis = data.analysis;
      setDocClassifications(analysis.document_classifications || []);
      setObservations(analysis.observations || []);
      setMissingDocs(analysis.missing_documents || []);
      setSummary(analysis.summary || "");

      // Populate form from extracted data
      const ext = analysis.extracted_invoice_data || {};
      setExtractedData(ext);
      setInvoiceNumber(ext.invoice_number || "");
      setInvoiceDate(ext.invoice_date || "");
      setDueDate(ext.due_date || "");
      setBuyerName(ext.buyer_name || "");
      setBuyerAddress(ext.buyer_address || "");
      setBuyerTaxId(ext.buyer_tax_id || "");
      setSellerName(ext.seller_name || "");
      setSellerAddress(ext.seller_address || "");
      setSellerTaxId(ext.seller_tax_id || "");
      setSubtotal(ext.subtotal?.toString() || "");
      setTaxAmount(ext.tax_amount?.toString() || "");
      setTotalAmount(ext.total_amount?.toString() || "");
      setCurrency(ext.currency || "USD");
      setLineItems(ext.line_items || []);

      setStep("analysis");
    } catch (e: any) {
      toast.error(e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!invoiceNumber || !buyerName || !totalAmount) {
      toast.error("Invoice number, buyer name, and total amount are required");
      return;
    }
    setSubmitting(true);

    try {
      setEligibilityError(null);

      // Determine the product type filter from the selected facility
      let facilityProductType = productType;
      if (selectedFacilityId) {
        const selectedFac = approvedFacilities.find(f => f.id === selectedFacilityId);
        if (selectedFac?.facility_type) {
          facilityProductType = selectedFac.facility_type;
        }
      }

      // Resolve the actual funder_user_id from funder_limits, filtered by product type
      const limitQuery = supabase
        .from("funder_limits")
        .select("funder_user_id, limit_amount, limit_receivables_purchase, limit_reverse_factoring, limit_payable_finance")
        .eq("borrower_id", borrower.id)
        .eq("organization_id", borrower.organization_id)
        .eq("status", "approved");

      const { data: funderLimits } = await limitQuery;

      // Find the best matching funder limit
      const funderLimit = funderLimits?.[0];

      if (funderLimit?.funder_user_id) {
        const { data: eligibility, error: eligErr } = await supabase.rpc(
          "check_funder_eligibility" as any,
          {
            _funder_user_id: funderLimit.funder_user_id,
            _borrower_id: borrower.id,
            _organization_id: borrower.organization_id,
            _invoice_amount: parseFloat(totalAmount),
            _product_type: facilityProductType,
          }
        );

        if (!eligErr && eligibility && Array.isArray(eligibility) && eligibility.length > 0) {
          const result = eligibility[0] as any;

          // Log the eligibility check to audit trail
          supabase.rpc("log_eligibility_check" as any, {
            _user_id: userId,
            _funder_user_id: funderLimit.funder_user_id,
            _borrower_id: borrower.id,
            _amount: parseFloat(totalAmount),
            _eligible: result?.eligible ?? true,
            _message: result?.message ?? "No result",
          }).catch(console.error);

          if (result && result.eligible === false) {
            const errorMsg = result.message || "Invoice exceeds available funder limit";
            setEligibilityError(errorMsg);
            toast.error(errorMsg);
            setSubmitting(false);
            return;
          }
          if (result && result.eligible === true) {
            toast.info(`Available limit: ${Number(result.available_limit).toLocaleString()}`);
          }
        }
      }
      // If no funder limit exists, proceed — borrower-submitted invoices may not have a funder assigned yet

    } catch (outerErr: any) {
      toast.error(outerErr.message || "Submission failed");
      setSubmitting(false);
      return;
    }

    try {
      // Create invoice
      const { data: invoice, error: invErr } = await supabase.from("invoices").insert({
        organization_id: borrower.organization_id,
        borrower_id: borrower.id,
        invoice_number: invoiceNumber,
        debtor_name: buyerName,
        amount: parseFloat(totalAmount),
        currency,
        issue_date: invoiceDate || new Date().toISOString().split("T")[0],
        due_date: dueDate || new Date().toISOString().split("T")[0],
        status: "pending",
        product_type: productType as any,
        requires_counterparty_acceptance: requiresAcceptance,
        counterparty_email: requiresAcceptance ? counterpartyEmail : null,
        counterparty_name: requiresAcceptance ? counterpartyName : null,
        acceptance_status: requiresAcceptance ? "pending" : "accepted",
        facility_request_id: selectedFacilityId || null,
      } as any).select("id").single();

      if (invErr) throw new Error(invErr.message);

      // Create submission record
      const { data: submission, error: subErr } = await supabase.from("invoice_submissions" as any).insert({
        organization_id: borrower.organization_id,
        borrower_id: borrower.id,
        invoice_id: invoice!.id,
        request_number: "",
        status: "submitted",
        ai_analysis: { classifications: docClassifications, summary },
        extracted_data: {
          invoice_number: invoiceNumber, invoice_date: invoiceDate, due_date: dueDate,
          buyer_name: buyerName, buyer_address: buyerAddress, buyer_tax_id: buyerTaxId,
          seller_name: sellerName, seller_address: sellerAddress, seller_tax_id: sellerTaxId,
          subtotal: parseFloat(subtotal) || 0, tax_amount: parseFloat(taxAmount) || 0,
          total_amount: parseFloat(totalAmount) || 0, currency, line_items: lineItems,
        },
        observations,
        borrower_comments: observationComments,
        document_comments: documentComments,
        overall_comment: overallComment || null,
        submitted_at: new Date().toISOString(),
        submitted_by: userId,
      } as any).select("*").single();

      if (subErr) throw new Error(subErr.message);

      // Link documents to submission
      const docLinks = files.filter(f => f.document_id).map((f, i) => ({
        submission_id: (submission as any).id,
        document_id: f.document_id!,
        ai_tag: docClassifications[i]?.tag || "other",
        ai_confidence: docClassifications[i]?.confidence || 0,
        borrower_comment: documentComments[i] || null,
      }));

      if (docLinks.length > 0) {
        await supabase.from("invoice_submission_documents" as any).insert(docLinks as any);
      }

      // Counterparty notification
      if (requiresAcceptance && counterpartyEmail) {
        supabase.functions.invoke("notify-counterparty", {
          body: { invoice_id: invoice!.id },
        }).catch(console.error);
      }

      toast.success(`Invoice submitted! Request: ${(submission as any).request_number}`);
      handleClose(false);
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const severityIcon = (s: string) => {
    switch (s) {
      case "critical": return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const stepProgress = step === "upload" ? 33 : step === "analysis" ? 66 : 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Invoice Submission
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Drag & drop all related documents to get started"}
            {step === "analysis" && "Review AI-extracted details and observations"}
            {step === "review" && "Final review before submission"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === "upload" ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"}`}>1</div>
            Upload
          </div>
          <div className="flex-1 h-0.5 bg-border rounded" />
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === "analysis" ? "bg-primary text-primary-foreground" : step === "review" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>2</div>
            Details
          </div>
          <div className="flex-1 h-0.5 bg-border rounded" />
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === "review" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>3</div>
            Review
          </div>
        </div>

        <ScrollArea className="flex-1 pr-4">
          {/* STEP 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4 py-2">
              <div
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className={`h-10 w-10 mx-auto mb-3 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
                <p className="font-medium text-foreground">
                  {dragOver ? "Drop files here" : "Drag & drop all invoice documents here"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Invoice, PO, Proof of Delivery, Packaging Slip, Banking Note, Buyer Email, etc.
                </p>
                <p className="text-xs text-muted-foreground mt-2">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addFiles(e.target.files)}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{files.length} document(s) selected</p>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                      <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.file.name}</p>
                        <p className="text-xs text-muted-foreground">{(f.file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      {f.uploaded && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFile(i)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Analysis & Form */}
          {step === "analysis" && (
            <div className="space-y-5 py-2">
              {/* AI Summary */}
              {summary && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 flex gap-3">
                    <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">AI Analysis Summary</p>
                      <p className="text-sm text-muted-foreground mt-1">{summary}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Document Classifications */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Document Classification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {docClassifications.map((dc, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{dc.file_name}</p>
                        {dc.description && <p className="text-xs text-muted-foreground">{dc.description}</p>}
                      </div>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {DOC_TAG_LABELS[dc.tag] || dc.tag}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{dc.confidence}%</span>
                    </div>
                  ))}
                  {missingDocs.length > 0 && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 mt-2">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Missing documents
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">{missingDocs.join(", ")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Product Type */}
              <div className="space-y-2">
                <Label>Product Type *</Label>
                <Select value={productType} onValueChange={setProductType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(pt => (
                      <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Facility Selection */}
              {approvedFacilities.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Approved Facility *</Label>
                  <Select value={selectedFacilityId} onValueChange={setSelectedFacilityId}>
                    <SelectTrigger><SelectValue placeholder="Choose a facility..." /></SelectTrigger>
                    <SelectContent>
                      {approvedFacilities.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.facility_type?.replace(/_/g, " ")} — {f.currency} {Number(f.approved_amount || f.amount_requested || 0).toLocaleString()}
                          {f.approved_tenor_months && ` (${f.approved_tenor_months}m)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedFacilityId && totalAmount && (() => {
                    const fac = approvedFacilities.find(f => f.id === selectedFacilityId);
                    const invoiceVal = parseFloat(totalAmount);
                    if (fac && invoiceVal > 0 && invoiceVal > Number(fac.approved_amount || fac.amount_requested || 0)) {
                      return (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Funding amount cannot exceed the facility limit ({fac.currency} {Number(fac.approved_amount || fac.amount_requested).toLocaleString()})
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
              {approvedFacilities.length === 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> No approved facilities found. You need an approved facility before submitting invoices.
                  </p>
                </div>
              )}

              {/* Extracted Invoice Details */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Invoice Details
                    <Badge variant="outline" className="text-xs font-normal">AI-populated</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Invoice No. *</Label>
                      <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Invoice Date</Label>
                      <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Due Date</Label>
                      <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-muted-foreground">Buyer Information</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Buyer Name *</Label>
                      <Input value={buyerName} onChange={e => setBuyerName(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Buyer Address</Label>
                      <Input value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Buyer Tax ID</Label>
                      <Input value={buyerTaxId} onChange={e => setBuyerTaxId(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>

                  <p className="text-xs font-medium text-muted-foreground">Seller Information</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Seller Name</Label>
                      <Input value={sellerName} onChange={e => setSellerName(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Seller Address</Label>
                      <Input value={sellerAddress} onChange={e => setSellerAddress(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Seller Tax ID</Label>
                      <Input value={sellerTaxId} onChange={e => setSellerTaxId(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>

                  <Separator />
                  <p className="text-xs font-medium text-muted-foreground">Amounts</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Subtotal</Label>
                      <Input type="number" value={subtotal} onChange={e => setSubtotal(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tax Amount</Label>
                      <Input type="number" value={taxAmount} onChange={e => setTaxAmount(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Total Amount *</Label>
                      <Input type="number" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Currency</Label>
                      <Input value={currency} onChange={e => setCurrency(e.target.value)} className="h-8 text-sm" />
                    </div>
                  </div>

                  {/* Line Items */}
                  {lineItems.length > 0 && (
                    <>
                      <Separator />
                      <p className="text-xs font-medium text-muted-foreground">Line Items</p>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Description</th>
                              <th className="text-right p-2 font-medium">Qty</th>
                              <th className="text-right p-2 font-medium">Unit Price</th>
                              <th className="text-right p-2 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lineItems.map((li: any, i: number) => (
                              <tr key={i} className="border-t">
                                <td className="p-2">{li.description}</td>
                                <td className="p-2 text-right">{li.quantity || "-"}</td>
                                <td className="p-2 text-right">{li.unit_price?.toLocaleString() || "-"}</td>
                                <td className="p-2 text-right">{li.total?.toLocaleString() || "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Observations */}
              {observations.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      AI Observations ({observations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {observations.map((obs, i) => (
                      <div key={i} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          {severityIcon(obs.severity)}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{obs.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{obs.description}</p>
                            {obs.documents_involved && (
                              <div className="flex gap-1 mt-1">
                                {obs.documents_involved.map((d: string, j: number) => (
                                  <Badge key={j} variant="outline" className="text-[10px]">{d}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Badge variant={obs.severity === "critical" ? "destructive" : obs.severity === "warning" ? "secondary" : "outline"} className="text-[10px] shrink-0">
                            {obs.severity}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Your comment on this observation</Label>
                          <Textarea
                            value={observationComments[i] || ""}
                            onChange={e => setObservationComments(prev => ({ ...prev, [i]: e.target.value }))}
                            placeholder="Add your comment or explanation..."
                            className="min-h-[60px] text-sm"
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Counterparty */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Counterparty Acceptance Required</Label>
                      <p className="text-xs text-muted-foreground">Counterparty must verify before funding</p>
                    </div>
                    <Switch checked={requiresAcceptance} onCheckedChange={setRequiresAcceptance} />
                  </div>
                  {requiresAcceptance && (
                    <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/30">
                      <div className="space-y-1">
                        <Label className="text-xs">Counterparty Name</Label>
                        <Input value={counterpartyName} onChange={e => setCounterpartyName(e.target.value)} className="h-8 text-sm" placeholder="Contact name" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Counterparty Email *</Label>
                        <Input type="email" value={counterpartyEmail} onChange={e => setCounterpartyEmail(e.target.value)} className="h-8 text-sm" placeholder="buyer@company.com" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === "review" && (
            <div className="space-y-5 py-2">
              {/* Summary card */}
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div><span className="text-muted-foreground">Invoice No:</span> <span className="font-medium">{invoiceNumber}</span></div>
                    <div><span className="text-muted-foreground">Product:</span> <span className="font-medium">{PRODUCT_TYPES.find(p => p.value === productType)?.label}</span></div>
                    <div><span className="text-muted-foreground">Buyer:</span> <span className="font-medium">{buyerName}</span></div>
                    <div><span className="text-muted-foreground">Seller:</span> <span className="font-medium">{sellerName || borrower.company_name}</span></div>
                    <div><span className="text-muted-foreground">Total Amount:</span> <span className="font-medium">{currency} {parseFloat(totalAmount || "0").toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">Due Date:</span> <span className="font-medium">{dueDate || "N/A"}</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* Documents with comments */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Documents ({files.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {files.map((f, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.file.name}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {DOC_TAG_LABELS[docClassifications[i]?.tag] || "Unknown"}
                        </Badge>
                      </div>
                      <Textarea
                        value={documentComments[i] || ""}
                        onChange={e => setDocumentComments(prev => ({ ...prev, [i]: e.target.value }))}
                        placeholder="Add comment on this document (optional)..."
                        className="min-h-[50px] text-sm"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Observations recap */}
              {observations.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Observations & Your Responses</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {observations.map((obs, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
                        {severityIcon(obs.severity)}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{obs.title}</p>
                          {observationComments[i] && (
                            <p className="text-xs text-primary mt-1 italic">Your response: {observationComments[i]}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Overall comment */}
              <div className="space-y-2">
                <Label>Overall Comment on Submission</Label>
                <Textarea
                  value={overallComment}
                  onChange={e => setOverallComment(e.target.value)}
                  placeholder="Any additional notes or context for this invoice submission..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            {step !== "upload" && (
              <Button variant="outline" onClick={() => setStep(step === "review" ? "analysis" : "upload")}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
            {step === "upload" && (
              <Button onClick={uploadAndAnalyze} disabled={files.length === 0 || analyzing}>
                {analyzing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Upload & Analyze</>
                )}
              </Button>
            )}
            {step === "analysis" && (
              <Button onClick={() => setStep("review")}>
                Review <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
            {step === "review" && (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /> Submit Invoice</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
