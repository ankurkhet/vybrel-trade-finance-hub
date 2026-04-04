import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borrowerId: string;
  organizationId: string;
  applicationId?: string;
  approvedMetadata?: any;
}

export function ReferToFunderDialog({ open, onOpenChange, borrowerId, organizationId, applicationId, approvedMetadata }: Props) {
  const [funders, setFunders] = useState<any[]>([]);
  const [counterparties, setCounterparties] = useState<any[]>([]);
  const [msaTerms, setMsaTerms] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recommendationId, setRecommendationId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    funder_user_id: "",
    counterparty_id: "",
    overall_limit: "",
    limit_receivables_purchase: "",
    limit_reverse_factoring: "",
    limit_payable_finance: "",
    currency: "GBP",
    base_rate_type: "Fixed Rate",
    base_rate_value: "",
    margin_pct: "",
  });

  useEffect(() => {
    if (open) {
      fetchFunders();
      fetchCounterparties();
      fetchRecommendation();
      // Pre-populate from CC approval metadata
      if (approvedMetadata) {
        setFormData(f => ({
          ...f,
          overall_limit: approvedMetadata.proposed_limit ? String(approvedMetadata.proposed_limit) : "",
          limit_receivables_purchase: approvedMetadata.approved_limits?.receivables_purchase ? String(approvedMetadata.approved_limits.receivables_purchase) : "",
          limit_reverse_factoring: approvedMetadata.approved_limits?.reverse_factoring ? String(approvedMetadata.approved_limits.reverse_factoring) : "",
          limit_payable_finance: approvedMetadata.approved_limits?.payable_finance ? String(approvedMetadata.approved_limits.payable_finance) : "",
          currency: approvedMetadata.currency || "GBP",
        }));
      }
    }
  }, [open]);

  const fetchRecommendation = async () => {
    if (!applicationId) return;
    const { data } = await supabase
      .from("credit_limit_recommendations" as any)
      .select("id, recommended_overall_limit, limit_receivables_purchase, limit_reverse_factoring, limit_payables_finance, risk_grade, recommended_rate, currency")
      .eq("application_id", applicationId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      const rec = data[0] as any;
      setRecommendationId(rec.id);
      // Pre-populate from recommendation if metadata didn't already
      if (!approvedMetadata) {
        setFormData(f => ({
          ...f,
          overall_limit: rec.recommended_overall_limit ? String(rec.recommended_overall_limit) : f.overall_limit,
          limit_receivables_purchase: rec.limit_receivables_purchase ? String(rec.limit_receivables_purchase) : f.limit_receivables_purchase,
          limit_reverse_factoring: rec.limit_reverse_factoring ? String(rec.limit_reverse_factoring) : f.limit_reverse_factoring,
          limit_payable_finance: rec.limit_payables_finance ? String(rec.limit_payables_finance) : f.limit_payable_finance,
          currency: rec.currency || f.currency,
        }));
      }
    }
  };

  const fetchFunders = async () => {
    const { data } = await supabase.rpc("get_org_funder_profiles", { _org_id: organizationId });
    if (data) setFunders(data);
    else setFunders([]);
  };

  const fetchCounterparties = async () => {
    const { data } = await supabase
      .from("borrower_counterparties")
      .select("counterparty_id, counterparties(id, company_name)")
      .eq("borrower_id", borrowerId)
      .eq("organization_id", organizationId);
    if (data) setCounterparties(data.map((bc: any) => bc.counterparties).filter(Boolean));
  };

  const handleFunderSelect = async (funderId: string) => {
    setFormData(f => ({ ...f, funder_user_id: funderId }));
    const { data: rels } = await supabase
      .from("funder_relationships")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("funder_user_id", funderId)
      .eq("agreement_status", "active")
      .order("created_at", { ascending: false })
      .limit(1);
    if (rels && rels.length > 0) {
      const active = rels[0];
      setMsaTerms(active);
      setFormData(f => ({
        ...f,
        base_rate_type: active.master_base_rate_type || "Fixed Rate",
        base_rate_value: active.master_base_rate_value ? String(active.master_base_rate_value) : "",
        margin_pct: active.master_margin_pct ? String(active.master_margin_pct) : "",
      }));
      toast.info(`Rates pre-populated from Master Agreement (${active.master_base_rate_type} + ${active.master_margin_pct}%)`);
    } else {
      setMsaTerms(null);
    }
  };

  const handleSubmit = async () => {
    if (!formData.funder_user_id) { toast.error("Please select a Funder"); return; }
    if (!formData.overall_limit && !formData.limit_receivables_purchase && !formData.limit_reverse_factoring && !formData.limit_payable_finance) {
      toast.error("Please specify at least one limit amount"); return;
    }
    setSubmitting(true);

    try {
      const selectedCp = counterparties.find(c => c.id === formData.counterparty_id);
      const { data: session } = await supabase.auth.getSession();
      const currentUserId = session?.session?.user?.id;

      // Step 9: Create funder_referrals record for audit trail
      if (recommendationId) {
        const { data: referral, error: refErr } = await supabase
          .from("funder_referrals" as any)
          .insert({
            recommendation_id: recommendationId,
            funder_user_id: formData.funder_user_id,
            organization_id: organizationId,
            referred_limit_amount: parseFloat(formData.overall_limit || "0"),
            referred_limit_rp: formData.limit_receivables_purchase ? parseFloat(formData.limit_receivables_purchase) : 0,
            referred_limit_rf: formData.limit_reverse_factoring ? parseFloat(formData.limit_reverse_factoring) : 0,
            referred_limit_pf: formData.limit_payable_finance ? parseFloat(formData.limit_payable_finance) : 0,
            referred_rate: parseFloat(formData.margin_pct || "0"),
            counterparty_scope: formData.counterparty_id ? "specific" : "all",
            status: "referred",
            created_by: currentUserId,
          } as any)
          .select("id")
          .single();

        if (refErr) { toast.error(refErr.message); setSubmitting(false); return; }

        // Create funder_limits linked to referral
        const payload: any = {
          organization_id: organizationId,
          borrower_id: borrowerId,
          funder_user_id: formData.funder_user_id,
          counterparty_id: formData.counterparty_id || null,
          counterparty_name: selectedCp?.company_name || null,
          limit_amount: parseFloat(formData.overall_limit || "0"),
          overall_limit: formData.overall_limit ? parseFloat(formData.overall_limit) : null,
          limit_receivables_purchase: formData.limit_receivables_purchase ? parseFloat(formData.limit_receivables_purchase) : null,
          limit_reverse_factoring: formData.limit_reverse_factoring ? parseFloat(formData.limit_reverse_factoring) : null,
          limit_payable_finance: formData.limit_payable_finance ? parseFloat(formData.limit_payable_finance) : null,
          scope: formData.counterparty_id ? "specific_counterparty" : "all_counterparties",
          currency: formData.currency,
          base_rate_type: formData.base_rate_type,
          base_rate_value: parseFloat(formData.base_rate_value || "0"),
          margin_pct: parseFloat(formData.margin_pct || "0"),
          status: "pending",
          referral_id: (referral as any)?.id || null,
          valid_from: new Date().toISOString().split("T")[0],
        };
        const { error } = await supabase.from("funder_limits").insert(payload);
        if (error) { toast.error(error.message); setSubmitting(false); return; }
      } else {
        // Fallback: no recommendation found, insert directly (backward-compatible)
        const payload: any = {
          organization_id: organizationId,
          borrower_id: borrowerId,
          funder_user_id: formData.funder_user_id,
          counterparty_id: formData.counterparty_id || null,
          counterparty_name: selectedCp?.company_name || null,
          limit_amount: parseFloat(formData.overall_limit || "0"),
          overall_limit: formData.overall_limit ? parseFloat(formData.overall_limit) : null,
          limit_receivables_purchase: formData.limit_receivables_purchase ? parseFloat(formData.limit_receivables_purchase) : null,
          limit_reverse_factoring: formData.limit_reverse_factoring ? parseFloat(formData.limit_reverse_factoring) : null,
          limit_payable_finance: formData.limit_payable_finance ? parseFloat(formData.limit_payable_finance) : null,
          scope: formData.counterparty_id ? "specific_counterparty" : "all_counterparties",
          currency: formData.currency,
          base_rate_type: formData.base_rate_type,
          base_rate_value: parseFloat(formData.base_rate_value || "0"),
          margin_pct: parseFloat(formData.margin_pct || "0"),
          status: "pending",
          valid_from: new Date().toISOString().split("T")[0],
        };
        const { error } = await supabase.from("funder_limits").insert(payload);
        if (error) { toast.error(error.message); setSubmitting(false); return; }
      }

      // Insert notification for the funder
      await supabase.from("notifications" as any).insert({
        user_id: formData.funder_user_id,
        title: "New Limit Referral",
        message: `A credit limit referral of ${formData.currency} ${Number(formData.overall_limit || 0).toLocaleString()} has been submitted for your review.`,
        type: "referral",
        link: "/funder/portfolio",
      });

      toast.success("Limit Request referred to Funder");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to refer to funder");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Refer to Funder</DialogTitle>
          <DialogDescription>
            Submit the approved credit limit to a funder. You can refer to multiple funders by opening this dialog again.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Select Funder *</Label>
            <Select value={formData.funder_user_id} onValueChange={handleFunderSelect}>
              <SelectTrigger><SelectValue placeholder="Choose funder..." /></SelectTrigger>
              <SelectContent>
                {funders.length === 0 && <SelectItem value="none" disabled>No active funders with MSA</SelectItem>}
                {funders.map(f => <SelectItem key={f.user_id} value={f.user_id}>{f.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Counterparty (Optional)</Label>
            <Select value={formData.counterparty_id} onValueChange={(v) => setFormData(f => ({ ...f, counterparty_id: v === "all" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="All Counterparties (Global)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Counterparties (Global)</SelectItem>
                {counterparties.map(cp => <SelectItem key={cp.id} value={cp.id}>{cp.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {recommendationId && (
            <div className="col-span-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Linked to CC Recommendation — full audit trail
              </Badge>
            </div>
          )}

          <div className="col-span-2 border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-3">REQUESTED LIMITS (from CC approval)</p>
          </div>
          <div className="space-y-2">
            <Label>Overall Limit ({formData.currency})</Label>
            <Input type="number" placeholder="0" value={formData.overall_limit} onChange={(e) => setFormData(f => ({ ...f, overall_limit: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Receivables Purchase ({formData.currency})</Label>
            <Input type="number" placeholder="0" value={formData.limit_receivables_purchase} onChange={(e) => setFormData(f => ({ ...f, limit_receivables_purchase: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Reverse Factoring ({formData.currency})</Label>
            <Input type="number" placeholder="0" value={formData.limit_reverse_factoring} onChange={(e) => setFormData(f => ({ ...f, limit_reverse_factoring: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Payable Finance ({formData.currency})</Label>
            <Input type="number" placeholder="0" value={formData.limit_payable_finance} onChange={(e) => setFormData(f => ({ ...f, limit_payable_finance: e.target.value }))} />
          </div>

          <div className="col-span-2 border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-3">INDEXING RATES (from MSA)</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">Base Rate Type {msaTerms && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 ml-2">MSA Default</Badge>}</Label>
            <Select value={formData.base_rate_type} onValueChange={(val) => setFormData(f => ({ ...f, base_rate_type: val }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Fixed Rate">Fixed Rate</SelectItem>
                <SelectItem value="SOFR">SOFR</SelectItem>
                <SelectItem value="SONIA">SONIA</SelectItem>
                <SelectItem value="EURIBOR">EURIBOR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">Base Rate Value (%) {msaTerms && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 ml-2">MSA Default</Badge>}</Label>
            <Input type="number" step="0.01" value={formData.base_rate_value} onChange={(e) => setFormData(f => ({ ...f, base_rate_value: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">Funder Margin (%) {msaTerms && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 ml-2">MSA Default</Badge>}</Label>
            <Input type="number" step="0.01" value={formData.margin_pct} onChange={(e) => setFormData(f => ({ ...f, margin_pct: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit to Funder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
