import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, XCircle, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KycGap {
  category: "document" | "validation" | "screening";
  severity: "warning" | "critical";
  label: string;
  detail: string;
}

const REQUIRED_DOC_TYPES = [
  { type: "certificate_of_incorporation", label: "Certificate of Incorporation" },
  { type: "memorandum_articles", label: "Memorandum & Articles" },
  { type: "proof_of_address", label: "Proof of Address" },
  { type: "bank_statement", label: "Bank Statement" },
  { type: "id_document", label: "ID Document" },
  { type: "financial_statement", label: "Financial Statement" },
];

function analyseGaps(documents: any[], borrower: any): KycGap[] {
  const gaps: KycGap[] = [];
  const meta = (borrower.metadata as any) || {};

  // 1. Document checks
  for (const req of REQUIRED_DOC_TYPES) {
    const matching = documents.filter((d: any) => d.document_type === req.type);
    if (matching.length === 0) {
      gaps.push({ category: "document", severity: "warning", label: req.label, detail: "Not uploaded" });
    } else {
      const latest = matching[0]; // already sorted desc
      if (latest.status === "rejected") {
        gaps.push({ category: "document", severity: "critical", label: req.label, detail: `Rejected: ${latest.rejection_reason || "no reason"}` });
      } else if (latest.status === "pending") {
        gaps.push({ category: "document", severity: "warning", label: req.label, detail: "Pending review" });
      }
    }
  }

  // 2. Sanctions screening
  const sanctions = meta.sanctions_results || meta.sanctions;
  if (!sanctions) {
    gaps.push({ category: "screening", severity: "warning", label: "Sanctions Screening", detail: "Not performed" });
  } else if (sanctions.match_count > 0 || sanctions.status === "match") {
    gaps.push({ category: "screening", severity: "critical", label: "Sanctions Screening", detail: `${sanctions.match_count || "Potential"} match(es) found` });
  }

  // 3. Bank validation
  const bankVal = meta.bank_validation;
  if (!bankVal) {
    gaps.push({ category: "validation", severity: "warning", label: "Bank Account Validation", detail: "Not performed" });
  } else if (bankVal.valid === false) {
    gaps.push({ category: "validation", severity: "critical", label: "Bank Account Validation", detail: bankVal.message || "Failed" });
  }

  // 4. Name verification
  const nameVerify = meta.name_verification || meta.truelayer_verification;
  if (!nameVerify) {
    gaps.push({ category: "validation", severity: "warning", label: "Name Verification", detail: "Not performed" });
  } else if (nameVerify.match === false || nameVerify.status === "no_match") {
    gaps.push({ category: "validation", severity: "critical", label: "Name Verification", detail: `Name mismatch: expected "${nameVerify.expected_name}", got "${nameVerify.verified_name || "unknown"}"` });
  }

  return gaps;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrower: any;
  documents: any[];
  profile: any;
  onComplete: () => void;
}

export function KycApprovalDialog({ open, onOpenChange, borrower, documents, profile, onComplete }: Props) {
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [notes, setNotes] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  const gaps = useMemo(() => analyseGaps(documents, borrower), [documents, borrower]);
  const criticalGaps = gaps.filter(g => g.severity === "critical");
  const warningGaps = gaps.filter(g => g.severity === "warning");
  const hasGaps = gaps.length > 0;

  const canApprove = !hasGaps || acknowledged;

  const handleApprove = async () => {
    setSaving(true);
    const kycApproval = {
      approved_by: profile?.user_id,
      approved_at: new Date().toISOString(),
      gaps_acknowledged: gaps.map(g => ({ label: g.label, severity: g.severity, detail: g.detail })),
      notes,
    };

    const existingMeta = (borrower.metadata as any) || {};
    const { error } = await supabase.from("borrowers").update({
      kyc_completed: true,
      metadata: { ...existingMeta, kyc_approval: kycApproval } as any,
    }).eq("id", borrower.id);

    if (error) { toast.error(error.message); setSaving(false); return; }

    await supabase.from("audit_logs").insert({
      user_id: profile?.user_id,
      user_email: profile?.email,
      action: "compliance.kyc_approved",
      resource_type: "borrower",
      resource_id: borrower.id,
      details: kycApproval as any,
    });

    toast.success("KYC approved");
    setSaving(false);
    resetAndClose();
    onComplete();
  };

  const handleReject = async () => {
    setSaving(true);
    const { error } = await supabase.from("borrowers").update({
      kyc_completed: false,
      onboarding_status: "documents_requested" as any,
    }).eq("id", borrower.id);

    if (error) { toast.error(error.message); setSaving(false); return; }

    await supabase.from("audit_logs").insert({
      user_id: profile?.user_id,
      user_email: profile?.email,
      action: "compliance.kyc_rejected",
      resource_type: "borrower",
      resource_id: borrower.id,
      details: { notes } as any,
    });

    toast.success("KYC rejected — status set to Documents Requested");
    setSaving(false);
    resetAndClose();
    onComplete();
  };

  const resetAndClose = () => {
    setMode(null);
    setNotes("");
    setAcknowledged(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>KYC Review — {borrower.company_name}</DialogTitle>
          <DialogDescription>
            Review KYC status and approve or reject.
          </DialogDescription>
        </DialogHeader>

        {/* Gap Analysis */}
        {criticalGaps.length > 0 && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>{criticalGaps.length} Critical Issue{criticalGaps.length > 1 ? "s" : ""}</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 space-y-1 text-xs">
                {criticalGaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span><strong>{g.label}:</strong> {g.detail}</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {warningGaps.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-700 dark:text-amber-400">{warningGaps.length} Warning{warningGaps.length > 1 ? "s" : ""}</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 space-y-1 text-xs">
                {warningGaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                    <span><strong>{g.label}:</strong> {g.detail}</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {gaps.length === 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700 dark:text-green-400">All checks passed</AlertTitle>
            <AlertDescription className="text-xs">All required documents are approved and validations are clear.</AlertDescription>
          </Alert>
        )}

        {/* Document summary */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document Summary</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {REQUIRED_DOC_TYPES.map(req => {
              const match = documents.find((d: any) => d.document_type === req.type);
              return (
                <div key={req.type} className="flex items-center gap-1.5 text-xs">
                  {match?.status === "approved" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  ) : match?.status === "rejected" ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  ) : match ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{req.label}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
                    {match?.status || "missing"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="kyc-notes">Notes / Rationale</Label>
          <Textarea
            id="kyc-notes"
            placeholder="Document your decision rationale..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Acknowledgment checkbox */}
        {hasGaps && (
          <div className="flex items-start gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <Checkbox
              id="ack"
              checked={acknowledged}
              onCheckedChange={v => setAcknowledged(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="ack" className="text-xs leading-relaxed cursor-pointer">
              I acknowledge the above KYC gaps and accept the associated risk of approving this borrower.
            </Label>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReject}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
            Reject KYC
          </Button>
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={saving || !canApprove}
          >
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
            Approve KYC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
