import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2, Upload, CheckCircle2, XCircle, AlertTriangle, FileText,
  Clock, RefreshCw, ChevronRight, BanknoteIcon,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface DisbursementAdvice {
  id: string;
  advice_number: string;
  status: string;
  bank_statement_path: string | null;
  bank_statement_uploaded_at: string | null;
  ai_match_result: any;
  completed_at: string | null;
  completed_by: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  disbursement_memos: {
    id: string;
    disbursement_amount: number;
    currency: string;
    invoice_id: string;
    status: string;
    invoices: {
      invoice_number: string;
      counterparty_name: string;
      total_amount: number;
    } | null;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending:                  { label: "Pending",         variant: "outline",     icon: <Clock className="h-3 w-3" /> },
  bank_statement_uploaded:  { label: "Statement Uploaded", variant: "secondary", icon: <FileText className="h-3 w-3" /> },
  completed:                { label: "Completed",       variant: "default",     icon: <CheckCircle2 className="h-3 w-3" /> },
  cancelled:                { label: "Cancelled",       variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
};

export function DisbursementAdvicesContent() {
  const { profile } = useAuth();
  const [advices, setAdvices] = useState<DisbursementAdvice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdvice, setSelectedAdvice] = useState<DisbursementAdvice | null>(null);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentRef, setPaymentRef] = useState("");

  const fetchAdvices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("disbursement_advices")
      .select(`
        *,
        disbursement_memos (
          id, disbursement_amount, currency, invoice_id, status,
          invoices ( invoice_number, counterparty_name, total_amount )
        )
      `)
      .order("created_at", { ascending: false });

    if (error) toast.error("Failed to load disbursement advices");
    setAdvices((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAdvices(); }, [fetchAdvices]);

  // ── Upload bank statement ─────────────────────────────────────────────────
  const handleUploadStatement = async (file: File) => {
    if (!selectedAdvice) return;
    if (!["text/csv", "application/pdf"].includes(file.type) &&
        !file.name.endsWith(".csv") && !file.name.endsWith(".pdf")) {
      toast.error("Only CSV and PDF files are supported");
      return;
    }

    setUploading(true);
    try {
      // Upload to storage
      const filePath = `disbursement-advices/${selectedAdvice.id}/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("bank-statements")
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      // Insert bank_statement_uploads row and link to advice
      const { data: upload, error: insertErr } = await supabase
        .from("bank_statement_uploads")
        .insert({
          organization_id: selectedAdvice.disbursement_memos?.invoices ? undefined : undefined,
          file_path: filePath,
          file_name: file.name,
          file_type: file.name.endsWith(".pdf") ? "pdf" : "csv",
          disbursement_advice_id: selectedAdvice.id,
          uploaded_by: profile?.user_id,
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      // Update advice with statement path
      await supabase
        .from("disbursement_advices")
        .update({
          bank_statement_path: filePath,
          bank_statement_uploaded_at: new Date().toISOString(),
          bank_statement_uploaded_by: profile?.user_id,
          status: "bank_statement_uploaded",
        })
        .eq("id", selectedAdvice.id);

      toast.success("Bank statement uploaded. Running AI matching...");

      // Invoke reconcile-bank-statement to parse and match
      const { error: reconErr } = await supabase.functions.invoke("reconcile-bank-statement", {
        body: {
          bank_statement_upload_id: upload.id,
          disbursement_advice_id: selectedAdvice.id,
          disbursement_amount: selectedAdvice.disbursement_memos?.disbursement_amount,
        },
      });

      if (reconErr) {
        toast.warning("AI matching could not run — please match manually");
      } else {
        toast.success("AI matching complete");
      }

      await fetchAdvices();
      // Refresh selected advice
      const { data: refreshed } = await supabase
        .from("disbursement_advices")
        .select(`*, disbursement_memos(*, invoices(*))`)
        .eq("id", selectedAdvice.id)
        .single();
      if (refreshed) setSelectedAdvice(refreshed as any);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    setUploading(false);
  };

  // ── Complete / confirm disbursement ───────────────────────────────────────
  const handleComplete = async () => {
    if (!selectedAdvice) return;
    setCompleting(true);
    try {
      const confirmedRef = paymentRef.trim() ||
        selectedAdvice.ai_match_result?.statement_reference ||
        `MANUAL-${Date.now()}`;

      // Mark advice completed
      await supabase
        .from("disbursement_advices")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: profile?.user_id,
          payment_reference: confirmedRef,
          notes: notes.trim() || null,
        })
        .eq("id", selectedAdvice.id);

      // Mark disbursement memo as disbursed and post journals
      const memoId = selectedAdvice.disbursement_memos?.id;
      if (memoId) {
        await supabase
          .from("disbursement_memos")
          .update({
            status: "disbursed",
            disbursed_at: new Date().toISOString(),
            payment_reference: confirmedRef,
          })
          .eq("id", memoId);

        // Post disbursement journal entries now (deferred from approval)
        const amount = Number(selectedAdvice.disbursement_memos?.disbursement_amount || 0);
        const currency = selectedAdvice.disbursement_memos?.currency || "GBP";

        const { error: journalErr } = await supabase.rpc("post_journal_batch", {
          entries: [
            {
              organization_id: null, // service role resolves from memo
              journal_type: "disbursement",
              reference_id: memoId,
              account_id: null,
              system_account: "borrower_disbursement_receivable",
              amount,
              direction: "debit",
              currency,
              description: `Disbursement confirmed — ref: ${confirmedRef}`,
            },
            {
              organization_id: null,
              journal_type: "disbursement",
              reference_id: memoId,
              account_id: null,
              system_account: "originator_funding_account",
              amount,
              direction: "credit",
              currency,
              description: `Disbursement funded — ref: ${confirmedRef}`,
            },
          ],
        });

        if (journalErr) {
          toast.error(`Journals failed: ${journalErr.message}`);
        } else {
          await supabase
            .from("disbursement_memos")
            .update({ journals_posted: true })
            .eq("id", memoId);
        }
      }

      toast.success("Disbursement confirmed and ledger updated");
      setSelectedAdvice(null);
      setNotes("");
      setPaymentRef("");
      await fetchAdvices();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete disbursement");
    }
    setCompleting(false);
  };

  const pendingCount = advices.filter(a => a.status === "pending").length;
  const uploadedCount = advices.filter(a => a.status === "bank_statement_uploaded").length;

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Manual disbursement confirmations — upload bank statement to confirm and post ledger entries
            </p>
          </div>
          <Button variant="outline" onClick={fetchAdvices}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-amber-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Awaiting bank statement</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-blue-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{uploadedCount}</p>
                  <p className="text-xs text-muted-foreground">Statement uploaded — review needed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-2xl font-bold">{advices.filter(a => a.status === "completed").length}</p>
                  <p className="text-xs text-muted-foreground">Completed this period</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : advices.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <BanknoteIcon className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No disbursement advices yet</p>
                <p className="text-xs text-muted-foreground">
                  Advices are created when a disbursement is approved without an active PSP
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Advice #</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Match</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advices.map((advice) => {
                    const cfg = STATUS_CONFIG[advice.status] || STATUS_CONFIG.pending;
                    const memo = advice.disbursement_memos;
                    const match = advice.ai_match_result;
                    return (
                      <TableRow
                        key={advice.id}
                        className={advice.status === "pending" ? "bg-amber-50/40" :
                          advice.status === "bank_statement_uploaded" ? "bg-blue-50/40" : ""}
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          {advice.advice_number}
                        </TableCell>
                        <TableCell className="text-sm">
                          {memo?.invoices?.invoice_number || "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {memo?.invoices?.counterparty_name || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {memo ? `${memo.currency || "GBP"} ${Number(memo.disbursement_amount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant} className="gap-1 text-xs">
                            {cfg.icon}{cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {match ? (
                            match.matched ? (
                              <Badge className="gap-1 text-xs bg-emerald-600 text-white">
                                <CheckCircle2 className="h-3 w-3" />
                                Matched ({match.confidence}%)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-300">
                                <AlertTriangle className="h-3 w-3" />
                                No match
                              </Badge>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(advice.created_at), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          {advice.status !== "completed" && advice.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              onClick={() => {
                                setSelectedAdvice(advice);
                                setNotes(advice.notes || "");
                                setPaymentRef(advice.payment_reference || advice.ai_match_result?.statement_reference || "");
                              }}
                            >
                              Review <ChevronRight className="h-3 w-3" />
                            </Button>
                          )}
                          {advice.status === "completed" && (
                            <span className="text-xs text-muted-foreground">
                              {advice.completed_at ? format(new Date(advice.completed_at), "dd MMM") : "Done"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      {/* ── Detail / Review Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!selectedAdvice} onOpenChange={(o) => !o && setSelectedAdvice(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Disbursement Advice — {selectedAdvice?.advice_number}
            </DialogTitle>
          </DialogHeader>

          {selectedAdvice && (
            <div className="space-y-5 py-2">
              {/* Memo summary */}
              <Card>
                <CardContent className="pt-4 pb-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Invoice</p>
                    <p className="font-medium">{selectedAdvice.disbursement_memos?.invoices?.invoice_number || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Counterparty</p>
                    <p className="font-medium">{selectedAdvice.disbursement_memos?.invoices?.counterparty_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Disbursement Amount</p>
                    <p className="text-lg font-bold">
                      {selectedAdvice.disbursement_memos?.currency || "GBP"}{" "}
                      {Number(selectedAdvice.disbursement_memos?.disbursement_amount || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant={STATUS_CONFIG[selectedAdvice.status]?.variant || "outline"} className="gap-1 text-xs mt-1">
                      {STATUS_CONFIG[selectedAdvice.status]?.icon}
                      {STATUS_CONFIG[selectedAdvice.status]?.label || selectedAdvice.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Upload section */}
              {selectedAdvice.status === "pending" && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Step 1 — Upload Bank Statement</h3>
                  <p className="text-xs text-muted-foreground">
                    Upload the bank statement (CSV or PDF) confirming this disbursement was sent. The system will auto-match the transaction by amount and reference.
                  </p>
                  <label className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 transition-colors">
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm font-medium">Click to upload bank statement</span>
                        <span className="text-xs text-muted-foreground">CSV or PDF • Max 10MB</span>
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv,.pdf"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadStatement(file);
                      }}
                    />
                  </label>
                </div>
              )}

              {/* AI match result */}
              {selectedAdvice.ai_match_result && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">AI Match Result</h3>
                  {selectedAdvice.ai_match_result.matched ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-1">
                      <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        Transaction matched ({selectedAdvice.ai_match_result.confidence}% confidence)
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-2">
                        <div>
                          <p className="font-medium text-foreground">Date</p>
                          <p>{selectedAdvice.ai_match_result.statement_date || "—"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Amount</p>
                          <p>{selectedAdvice.ai_match_result.statement_amount?.toLocaleString("en-GB", { minimumFractionDigits: 2 }) || "—"}</p>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Reference</p>
                          <p className="font-mono">{selectedAdvice.ai_match_result.statement_reference || "—"}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 text-amber-700 font-medium text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        No automatic match found — please enter reference manually below
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual confirmation fields */}
              {(selectedAdvice.status === "bank_statement_uploaded" || selectedAdvice.status === "pending") && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    {selectedAdvice.status === "bank_statement_uploaded" ? "Step 2 — " : ""}
                    Confirm Disbursement
                  </h3>
                  <div className="space-y-2">
                    <Label htmlFor="paymentRef" className="text-xs">Bank Payment Reference</Label>
                    <input
                      id="paymentRef"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="e.g. BACS-20260410-00123"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Pre-filled from AI match if available. Override if needed.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      rows={2}
                      placeholder="Any notes for audit trail..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedAdvice(null)}>
              Close
            </Button>
            {selectedAdvice && selectedAdvice.status !== "completed" && selectedAdvice.status !== "cancelled" && (
              <Button
                onClick={handleComplete}
                disabled={completing}
                className="gap-2"
              >
                {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Mark as Completed & Post to Ledger
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function DisbursementAdvices() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Disbursement Advices</h1>
        </div>
        <DisbursementAdvicesContent />
      </div>
    </DashboardLayout>
  );
}
