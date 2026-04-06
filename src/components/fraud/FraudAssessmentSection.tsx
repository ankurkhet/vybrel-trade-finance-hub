import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ShieldAlert, ShieldX, Shield, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FraudAssessmentSectionProps {
  invoice: any;
  fraudCheck?: any;
  canOverride: boolean;
  onOverrideComplete: () => void;
}

export function FraudAssessmentSection({ invoice, fraudCheck, canOverride, onOverrideComplete }: FraudAssessmentSectionProps) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overriding, setOverriding] = useState(false);

  const score = invoice.fraud_score ?? fraudCheck?.fraud_score ?? 0;
  const status = invoice.fraud_status || "pending";
  const reasons = fraudCheck?.reasons || [];

  const scoreColor = score >= 70 ? "bg-red-500" : score >= 40 ? "bg-amber-500" : "bg-emerald-500";

  const handleOverride = async () => {
    if (!overrideReason.trim()) {
      toast.error("Override reason is required");
      return;
    }
    setOverriding(true);
    try {
      if (fraudCheck?.id) {
        await supabase
          .from("invoice_fraud_checks" as any)
          .update({
            override_by: (await supabase.auth.getUser()).data.user?.id,
            override_at: new Date().toISOString(),
            override_reason: overrideReason,
          })
          .eq("id", fraudCheck.id);
      }

      await supabase
        .from("invoices")
        .update({ fraud_status: "overridden" } as any)
        .eq("id", invoice.id);

      await supabase.from("audit_logs").insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: "fraud_override",
        resource_type: "invoice",
        resource_id: invoice.id,
        details: { reason: overrideReason, previous_status: status, score },
      });

      toast.success("Fraud check overridden successfully");
      setOverrideOpen(false);
      setOverrideReason("");
      onOverrideComplete();
    } catch (err: any) {
      toast.error(err.message || "Override failed");
    } finally {
      setOverriding(false);
    }
  };

  if (status === "pending" && !fraudCheck) return null;

  return (
    <>
      <Separator />
      <div className="space-y-3">
        <Label className="text-sm font-medium">Fraud Assessment</Label>

        {/* Score gauge */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Fraud Score</span>
            <span className="font-semibold">{score}/100</span>
          </div>
          <div className="relative h-3 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${scoreColor}`}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
        </div>

        {/* Reasons */}
        {reasons.length > 0 && (
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-xs font-medium text-foreground">Risk Factors</p>
            {reasons.map((r: string, i: number) => (
              <p key={i} className="text-xs text-muted-foreground">• {r}</p>
            ))}
          </div>
        )}

        {/* Duplicate matches */}
        {fraudCheck?.duplicate_matches && (fraudCheck.duplicate_matches as any[]).length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Duplicate Matches Found</p>
            {(fraudCheck.duplicate_matches as any[]).map((d: any, i: number) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                {d.invoice_number} — {d.debtor_name} ({d.match_type.replace(/_/g, " ")}, {d.similarity_score}% match)
              </p>
            ))}
          </div>
        )}

        {/* Override button */}
        {canOverride && (status === "flagged" || status === "blocked") && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setOverrideOpen(true)}
          >
            <Shield className="mr-1 h-3 w-3" /> Override Fraud Check
          </Button>
        )}

        {status === "overridden" && fraudCheck?.override_reason && (
          <div className="rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-950/20 p-3">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Override Applied
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{fraudCheck.override_reason}</p>
          </div>
        )}
      </div>

      {/* Override Dialog */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Fraud Check</DialogTitle>
            <DialogDescription>
              This invoice has been {status} with a fraud score of {score}. Provide a reason for overriding this check.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Override Reason *</Label>
            <Textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why this fraud check should be overridden..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>Cancel</Button>
            <Button onClick={handleOverride} disabled={overriding || !overrideReason.trim()}>
              {overriding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
