import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, Loader2, Plus, Info, AlertCircle, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export function FunderLimitsTab({ borrowerId, organizationId }: { borrowerId: string, organizationId: string }) {
  const [limits, setLimits] = useState<any[]>([]);
  const [funders, setFunders] = useState<any[]>([]);
  const [counterparties, setCounterparties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msaTerms, setMsaTerms] = useState<any>(null);
  
  const [referDialog, setReferDialog] = useState(false);
  const [formData, setFormData] = useState({
    funder_user_id: "",
    counterparty_id: "",
    limit_amount: "",
    currency: "GBP",
    base_rate_type: "Fixed Rate",
    base_rate_value: "",
    margin_pct: "",
    originator_margin_pct: "",
    overall_limit: "",
    limit_receivables_purchase: "",
    limit_reverse_factoring: "",
    limit_payable_finance: "",
    scope: "specific_counterparty",
  });
  const [submitting, setSubmitting] = useState(false);
  const [counterOfferAction, setCounterOfferAction] = useState<{ limitId: string; action: "accepted" | "rejected" } | null>(null);

  useEffect(() => {
    fetchFunders();
    fetchLimits();
    fetchCounterparties();
  }, [borrowerId]);

  const fetchCounterparties = async () => {
    const { data } = await supabase
      .from("borrower_counterparties")
      .select("counterparty_id, counterparties(id, company_name)")
      .eq("borrower_id", borrowerId)
      .eq("organization_id", organizationId);
    if (data) {
      setCounterparties(data.map((bc: any) => bc.counterparties).filter(Boolean));
    }
  };

  const fetchFunders = async () => {
    // Replaced RPC with safe direct query mapped against profiles
    const { data: roleRecords } = await supabase.from('user_roles').select('user_id').eq('role', 'funder');
    const funderUserIds = roleRecords?.map((r: any) => r.user_id) || [];
    
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', organizationId)
      .in('id', funderUserIds.length ? funderUserIds : ['00000000-0000-0000-0000-000000000000']);
      
    if (data) setFunders(data);
    else setFunders([]);
  };

  const fetchLimits = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("funder_limits")
      .select(`*, funder:profiles!funder_limits_funder_user_id_fkey(full_name)`)
      .eq("borrower_id", borrowerId)
      .order("created_at", { ascending: false });
    if (data) setLimits(data);
    setLoading(false);
  };

  const handleFunderSelect = async (funderId: string) => {
    setFormData(f => ({...f, funder_user_id: funderId}));
    
    const { data: rels } = await supabase
      .from('funder_relationships')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('funder_user_id', funderId)
      .eq('agreement_status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (rels && rels.length > 0) {
       const active = rels[0];
       setMsaTerms(active);
       setFormData(f => ({
         ...f,
         base_rate_type: active.master_base_rate_type || 'Fixed Rate',
         base_rate_value: active.master_base_rate_value ? String(active.master_base_rate_value) : "",
         margin_pct: active.master_margin_pct ? String(active.master_margin_pct) : ""
       }));
       toast.info(`Rates pre-populated from Master Agreement (${active.master_base_rate_type} + ${active.master_margin_pct}%)`);
    } else {
       setMsaTerms(null);
    }
  };

  const resetForm = () => {
    setFormData({
      funder_user_id: "", counterparty_id: "", limit_amount: "", currency: "GBP",
      base_rate_type: "Fixed Rate", base_rate_value: "", margin_pct: "", originator_margin_pct: "",
      overall_limit: "", limit_receivables_purchase: "", limit_reverse_factoring: "",
      limit_payable_finance: "", scope: "specific_counterparty",
    });
    setMsaTerms(null);
  };

  const handleRefer = async () => {
    if (!formData.funder_user_id) {
      toast.error("Please select a Funder");
      return;
    }
    if (!formData.overall_limit && !formData.limit_receivables_purchase && !formData.limit_reverse_factoring && !formData.limit_payable_finance) {
      toast.error("Please specify at least one limit amount (overall or per-product)");
      return;
    }
    setSubmitting(true);

    const selectedCp = counterparties.find(c => c.id === formData.counterparty_id);

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
      originator_margin_pct: parseFloat(formData.originator_margin_pct || "0"),
      status: "pending"
    };

    const { error } = await supabase.from("funder_limits").insert(payload);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Limit Request referred to Funder");
      setReferDialog(false);
      resetForm();
      fetchLimits();
    }
    setSubmitting(false);
  };

  const handleCounterOfferResponse = async (limitId: string, action: "accepted" | "rejected") => {
    setCounterOfferAction({ limitId, action });
    const { error } = await supabase
      .from("funder_limits")
      .update({ status: action } as any)
      .eq("id", limitId);
    if (error) {
      toast.error("Failed to update counter-offer: " + error.message);
    } else {
      toast.success(`Counter-offer ${action}`);
      fetchLimits();
    }
    setCounterOfferAction(null);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <div>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Funder Limit Allocations</CardTitle>
          <CardDescription>Manage referred credit limits. You can refer the same deal to multiple funders.</CardDescription>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setReferDialog(true); }}><Plus className="h-4 w-4 mr-2" /> Request Funder Limit</Button>
      </CardHeader>
      <div className="bg-blue-50/50 border-y border-blue-100 p-3 mx-6 mb-4 rounded-md">
        <div className="flex items-start gap-2">
           <Info className="h-4 w-4 text-blue-600 mt-0.5" />
           <div className="text-xs text-blue-800">
             <span className="font-semibold block mb-0.5">Multi-Funder Distribution Strategy</span>
             You can refer this borrower to multiple funders. The platform automatically aggregates these limits into a <strong>Global Ceiling</strong> for the borrower.
           </div>
        </div>
      </div>
      <CardContent>
        {limits.length === 0 ? (
           <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
             No active or pending funder limits requested.
           </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funder</TableHead>
                <TableHead>Limit Scope</TableHead>
                <TableHead>Overall</TableHead>
                <TableHead>Recv. Purchase</TableHead>
                <TableHead>Rev. Factoring</TableHead>
                <TableHead>Pay. Finance</TableHead>
                <TableHead>Index Rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {limits.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.funder?.full_name || "Unknown Funder"}</TableCell>
                  <TableCell>
                    {l.counterparty_name ? (
                      <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 text-xs font-semibold">
                        {l.counterparty_name}
                      </span>
                    ) : (
                      <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded-md border border-purple-100 text-xs font-semibold">
                        All Counterparties
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.overall_limit ? `${l.currency} ${Number(l.overall_limit).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.limit_receivables_purchase ? `${l.currency} ${Number(l.limit_receivables_purchase).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.limit_reverse_factoring ? `${l.currency} ${Number(l.limit_reverse_factoring).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.limit_payable_finance ? `${l.currency} ${Number(l.limit_payable_finance).toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-xs">{l.base_rate_type} + {l.margin_pct}%</TableCell>
                  <TableCell>
                    {l.status === 'counter_offered' ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">Counter-offered</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-green-700 hover:bg-green-50"
                          disabled={!!counterOfferAction}
                          onClick={() => handleCounterOfferResponse(l.id, "accepted")}
                        >
                          {counterOfferAction?.limitId === l.id && counterOfferAction.action === "accepted"
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <CheckCircle2 className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-destructive hover:bg-red-50"
                          disabled={!!counterOfferAction}
                          onClick={() => handleCounterOfferResponse(l.id, "rejected")}
                        >
                          {counterOfferAction?.limitId === l.id && counterOfferAction.action === "rejected"
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <XCircle className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    ) : (
                      <Badge variant={l.status === 'pending' ? "secondary" : l.status === 'approved' || l.status === 'accepted' ? "outline" : "destructive"}>
                        {l.status}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={referDialog} onOpenChange={setReferDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Refer Limit to Funder</DialogTitle>
            <DialogDescription>
              Submit a requested exposure profile. You may refer the same borrower to multiple funders. Internal originator margins are hidden.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Select Funder *</Label>
              <Select value={formData.funder_user_id} onValueChange={handleFunderSelect}>
                <SelectTrigger><SelectValue placeholder="Choose funder..." /></SelectTrigger>
                <SelectContent>
                  {funders.length === 0 && <SelectItem value="none" disabled>No active funders with MSA</SelectItem>}
                  {funders.map(f => <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Counterparty (Optional)</Label>
              <Select value={formData.counterparty_id} onValueChange={(v) => setFormData(f => ({...f, counterparty_id: v === "all" ? "" : v}))}>
                <SelectTrigger><SelectValue placeholder="All Counterparties (Global)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counterparties (Global)</SelectItem>
                  {counterparties.map(cp => <SelectItem key={cp.id} value={cp.id}>{cp.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">REQUESTED LIMITS (specify overall and/or per-product)</p>
              <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Funder limit allocations construct the Global Ceiling limit for the borrower automatically.</p>
            </div>

            <div className="space-y-2">
              <Label>Overall Limit ({formData.currency})</Label>
              <Input type="number" placeholder="0" value={formData.overall_limit} onChange={(e) => setFormData(f => ({...f, overall_limit: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Receivables Purchase ({formData.currency})</Label>
              <Input type="number" placeholder="0" value={formData.limit_receivables_purchase} onChange={(e) => setFormData(f => ({...f, limit_receivables_purchase: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Reverse Factoring ({formData.currency})</Label>
              <Input type="number" placeholder="0" value={formData.limit_reverse_factoring} onChange={(e) => setFormData(f => ({...f, limit_reverse_factoring: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label>Payable Finance ({formData.currency})</Label>
              <Input type="number" placeholder="0" value={formData.limit_payable_finance} onChange={(e) => setFormData(f => ({...f, limit_payable_finance: e.target.value}))} />
            </div>

            <div className="col-span-2 border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-3">INDEXING RATES (from MSA)</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">Base Rate Type {msaTerms && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 ml-2">MSA Default</Badge>}</Label>
              <Select value={formData.base_rate_type} onValueChange={(val) => setFormData(f => ({...f, base_rate_type: val}))}>
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
              <Input type="number" step="0.01" value={formData.base_rate_value} onChange={(e) => setFormData(f => ({...f, base_rate_value: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">Funder Margin (%) {msaTerms && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 ml-2">MSA Default</Badge>}</Label>
              <Input type="number" step="0.01" value={formData.margin_pct} onChange={(e) => setFormData(f => ({...f, margin_pct: e.target.value}))} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-purple-700">Originator Margin (%)</Label>
              <Input type="number" step="0.01" value={formData.originator_margin_pct} onChange={(e) => setFormData(f => ({...f, originator_margin_pct: e.target.value}))} />
              <p className="text-[10px] text-muted-foreground">Hidden from Funder</p>
            </div>
            
            {(formData.base_rate_value || formData.margin_pct || formData.originator_margin_pct) && (
               <div className="col-span-2 bg-muted/50 p-3 rounded-lg border text-sm mt-2">
                 Effective Client Rate: <strong>{(Number(formData.base_rate_value) + Number(formData.margin_pct) + Number(formData.originator_margin_pct)).toFixed(2)}%</strong>
                 <span className="text-xs text-muted-foreground block mt-1">({formData.base_rate_type} {formData.base_rate_value}% + Funder {formData.margin_pct}% + Vybrel {formData.originator_margin_pct}%)</span>
               </div>
            )}
            
            {!msaTerms && formData.funder_user_id && (
               <div className="col-span-2 bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200 text-sm mt-2 flex items-start gap-2">
                 <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                 <div>
                   <p className="font-semibold text-xs">Missing Master Agreement (MSA)</p>
                   <p className="text-[10px]">You can request limits now, but the Facility Offer Letter (FOL) will be blocked until an active MSA is recorded and Credit Committee approval is obtained.</p>
                 </div>
               </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferDialog(false)}>Cancel</Button>
            <Button onClick={handleRefer} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit to Funder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
