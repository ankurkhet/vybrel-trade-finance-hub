import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Loader2, Upload, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Scale, FileText, Search, AlertCircle, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface UploadRow {
  id: string;
  file_name: string;
  file_type: string;
  upload_date: string;
  statement_from_date: string | null;
  statement_to_date: string | null;
  status: string;
  total_lines: number | null;
  matched_lines: number | null;
  unmatched_lines: number | null;
  created_at: string;
}

interface MatchRow {
  id: string;
  statement_line_index: number;
  statement_date: string | null;
  statement_amount: number | null;
  statement_reference: string | null;
  statement_description: string | null;
  match_type: string;
  match_confidence: number | null;
  match_notes: string | null;
  payment_instruction_id: string | null;
}

const MATCH_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  auto_matched:     { label: "Auto-matched",     variant: "default",     color: "text-emerald-600" },
  manually_matched: { label: "Manual match",     variant: "secondary",   color: "text-blue-600" },
  unmatched:        { label: "Unmatched",         variant: "outline",     color: "text-amber-600" },
  exception:        { label: "Exception",         variant: "destructive", color: "text-destructive" },
};

export default function Reconciliation() {
  const { profile } = useAuth();
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState<UploadRow | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [weeklyReminderDue, setWeeklyReminderDue] = useState(false);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("bank_statement_uploads")
      .select("*")
      .is("disbursement_advice_id", null)   // only general recon uploads, not advice-specific
      .order("created_at", { ascending: false });
    setUploads(((data || []) as any) as UploadRow[]);
    setLoading(false);
  }, []);

  const checkWeeklyReminder = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("workflow_event_queue")
      .select("id")
      .eq("event_type", "weekly_reconciliation_due")
      .eq("new_status", "pending")
      .maybeSingle();
    setWeeklyReminderDue(!!data);
  }, []);

  useEffect(() => {
    fetchUploads();
    checkWeeklyReminder();
  }, [fetchUploads, checkWeeklyReminder]);

  const fetchMatches = async (uploadId: string) => {
    setMatchesLoading(true);
    const { data } = await (supabase as any)
      .from("reconciliation_matches")
      .select("*")
      .eq("bank_statement_upload_id", uploadId)
      .order("statement_line_index");
    setMatches(((data || []) as any) as MatchRow[]);
    setMatchesLoading(false);
  };

  // ── Upload & process a bank statement ─────────────────────────────────────
  const handleUpload = async (file: File) => {
    if (!["text/csv", "application/pdf"].includes(file.type) &&
        !file.name.endsWith(".csv") && !file.name.endsWith(".pdf")) {
      toast.error("Only CSV and PDF files are supported");
      return;
    }

    setUploading(true);
    try {
      const filePath = `reconciliation/${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("bank-statements")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: uploadRow, error: insertErr } = await supabase
        .from("bank_statement_uploads")
        .insert({
          file_path: filePath,
          file_name: file.name,
          file_type: file.name.endsWith(".pdf") ? "pdf" : "csv",
          statement_from_date: fromDate || null,
          statement_to_date: toDate || null,
          uploaded_by: profile?.user_id,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      toast.success("File uploaded. Running reconciliation...");

      const { error: fnErr } = await supabase.functions.invoke("reconcile-bank-statement", {
        body: { bank_statement_upload_id: uploadRow.id },
      });

      if (fnErr) {
        toast.error(`Reconciliation error: ${fnErr.message}`);
      } else {
        toast.success("Reconciliation complete");
        // Dismiss weekly reminder if pending
        if (weeklyReminderDue) {
          await (supabase as any)
            .from("workflow_event_queue")
            .update({ new_status: "processed" })
            .eq("event_type", "weekly_reconciliation_due")
            .eq("new_status", "pending");
          setWeeklyReminderDue(false);
        }
      }

      await fetchUploads();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    setUploading(false);
  };

  // ── Manual match for an unmatched line ───────────────────────────────────
  const handleManualMatch = async (matchId: string, paymentInstructionId: string) => {
    await supabase
      .from("reconciliation_matches")
      .update({
        match_type: "manually_matched",
        payment_instruction_id: paymentInstructionId,
        matched_by: profile?.user_id,
        matched_at: new Date().toISOString(),
      })
      .eq("id", matchId);
    toast.success("Match recorded");
    if (selectedUpload) fetchMatches(selectedUpload.id);
  };

  const pendingCount = uploads.filter(u => u.status === "pending" || u.status === "processing").length;
  const processedCount = uploads.filter(u => u.status === "processed").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              Bank Reconciliation
            </h1>
            <p className="text-sm text-muted-foreground">
              Upload bank statements to auto-match transactions against payment instructions
            </p>
          </div>
          <Button variant="outline" onClick={fetchUploads}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Weekly reminder banner */}
        {weeklyReminderDue && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Weekly reconciliation is due</p>
              <p className="text-xs text-amber-700">Upload this week's bank statement below to reconcile payments.</p>
            </div>
          </div>
        )}

        {/* Upload card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upload Bank Statement</CardTitle>
            <CardDescription>
              CSV or PDF from your bank. The system will parse and auto-match transactions to payment instructions.
              If PSP is connected, day-end reconciliation runs automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Statement From Date</Label>
                <input
                  type="date"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Statement To Date</Label>
                <input
                  type="date"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
            </div>

            <label className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border p-8 cursor-pointer hover:border-primary/50 transition-colors">
              {uploading ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Uploading and reconciling...</span>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm font-medium">Click to upload bank statement</span>
                  <span className="text-xs text-muted-foreground">CSV or PDF · Max 20MB</span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                accept=".csv,.pdf"
                disabled={uploading}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Uploads", value: uploads.length, icon: <FileText className="h-5 w-5 text-primary" /> },
            { label: "Processing", value: pendingCount, icon: <Loader2 className="h-5 w-5 text-amber-500" /> },
            { label: "Processed", value: processedCount, icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> },
            {
              label: "Unmatched Lines",
              value: uploads.reduce((sum, u) => sum + (u.unmatched_lines || 0), 0),
              icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
            },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  {stat.icon}
                  <div>
                    <p className="text-xl font-bold">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Upload history */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upload History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : uploads.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Scale className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No bank statements uploaded yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Statement Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Lines</TableHead>
                    <TableHead className="text-center">Matched</TableHead>
                    <TableHead className="text-center">Unmatched</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads.map(upload => {
                    const matchPct = upload.total_lines
                      ? Math.round(((upload.matched_lines || 0) / upload.total_lines) * 100)
                      : null;
                    return (
                      <TableRow key={upload.id} className={upload.unmatched_lines ? "bg-amber-50/30" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium truncate max-w-[200px]">{upload.file_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {upload.statement_from_date && upload.statement_to_date
                            ? `${format(new Date(upload.statement_from_date), "dd MMM")} – ${format(new Date(upload.statement_to_date), "dd MMM yyyy")}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={upload.status === "processed" ? "default" :
                              upload.status === "failed" ? "destructive" : "secondary"}
                            className="text-xs capitalize"
                          >
                            {upload.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{upload.total_lines ?? "—"}</TableCell>
                        <TableCell className="text-center">
                          {upload.matched_lines != null ? (
                            <span className="text-sm text-emerald-600 font-medium">
                              {upload.matched_lines}
                              {matchPct != null && <span className="text-xs text-muted-foreground ml-1">({matchPct}%)</span>}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {(upload.unmatched_lines || 0) > 0 ? (
                            <span className="text-sm text-amber-600 font-medium">{upload.unmatched_lines}</span>
                          ) : upload.status === "processed" ? (
                            <span className="text-sm text-emerald-600">0</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(upload.created_at), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          {upload.status === "processed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1 text-xs"
                              onClick={() => {
                                setSelectedUpload(upload);
                                fetchMatches(upload.id);
                              }}
                            >
                              View <ChevronRight className="h-3 w-3" />
                            </Button>
                          )}
                          {upload.status === "processing" && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
      </div>

      {/* ── Match Results Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!selectedUpload} onOpenChange={o => !o && setSelectedUpload(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Match Results — {selectedUpload?.file_name}
            </DialogTitle>
          </DialogHeader>

          {/* Summary bar */}
          {selectedUpload && (
            <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3 text-sm">
              <span className="text-muted-foreground">{selectedUpload.total_lines} lines total</span>
              <span className="text-emerald-600 font-medium">{selectedUpload.matched_lines} matched</span>
              {(selectedUpload.unmatched_lines || 0) > 0 && (
                <span className="text-amber-600 font-medium">{selectedUpload.unmatched_lines} unmatched</span>
              )}
              {(selectedUpload.unmatched_lines || 0) === 0 && (
                <span className="flex items-center gap-1 text-emerald-600 font-medium ml-auto">
                  <CheckCircle2 className="h-4 w-4" /> Fully reconciled
                </span>
              )}
            </div>
          )}

          {matchesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs">Reference</TableHead>
                  <TableHead className="text-xs">Match</TableHead>
                  <TableHead className="text-xs">Confidence</TableHead>
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map(m => {
                  const cfg = MATCH_CONFIG[m.match_type] || MATCH_CONFIG.unmatched;
                  return (
                    <TableRow
                      key={m.id}
                      className={m.match_type === "unmatched" ? "bg-amber-50/30" :
                        m.match_type === "exception" ? "bg-destructive/5" : ""}
                    >
                      <TableCell className="text-xs">{m.statement_date || "—"}</TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {m.statement_amount != null
                          ? m.statement_amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {m.statement_description || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{m.statement_reference || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="text-[10px] gap-1">
                          {m.match_type === "auto_matched" && <CheckCircle2 className="h-2.5 w-2.5" />}
                          {m.match_type === "unmatched" && <AlertTriangle className="h-2.5 w-2.5" />}
                          {m.match_type === "exception" && <XCircle className="h-2.5 w-2.5" />}
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.match_confidence != null ? `${m.match_confidence}%` : "—"}
                      </TableCell>
                      <TableCell>
                        {m.match_type === "unmatched" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] gap-1"
                            onClick={async () => {
                              const ref = prompt("Enter payment instruction ID to match:");
                              if (ref) handleManualMatch(m.id, ref);
                            }}
                          >
                            <Search className="h-3 w-3" /> Match
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
