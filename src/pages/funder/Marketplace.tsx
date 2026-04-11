import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Loader2, Search, DollarSign, Info, Handshake, CheckCircle2, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function LimitAssessment() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assessDialog, setAssessDialog] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasActiveMsa, setHasActiveMsa] = useState<boolean | null>(null);
  const [msaRates, setMsaRates] = useState<any>(null);
  const [otherFunderLimits, setOtherFunderLimits] = useState<any[]>([]);
  const [msas, setMsas] = useState<any[]>([]);

  // Assessment form state
  const [formOverall, setFormOverall] = useState("");
  const [formRP, setFormRP] = useState("");
  const [formRF, setFormRF] = useState("");
  const [formPF, setFormPF] = useState("");
  const [formScope, setFormScope] = useState("specific_counterparty");

  useEffect(() => {
    fetchLimits();
    const channel = supabase
      .channel("funder-limits")
      .on("postgres_changes", { event: "*", schema: "public", table: "funder_limits" }, () => {
        fetchLimits();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchLimits = async () => {
    setLoading(true);
    if (!user?.id) return;
    
    const { data: msaData } = await supabase
      .from("funder_relationships")
      .select("id")
      .eq("funder_user_id", user.id)
      .eq("agreement_status", "active")
      .limit(1);
    setHasActiveMsa((msaData?.length ?? 0) > 0);
    if (msaData && msaData.length > 0) setMsas(msaData);
    else {
      // Fetch all MSAs (including pending/inactive) so funder can see their agreement status
      const { data: allMsas } = await supabase
        .from("funder_relationships")
        .select("*, organization:organizations(name)")
        .eq("funder_user_id", user!.id)
        .order("created_at", { ascending: false });
      setMsas(allMsas || []);
    }

    const { data, error } = await supabase
      .from("funder_limits")
      .select("*, borrowers(company_name)")
      .eq("funder_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
    } else {
      setLimits(data || []);
    }
    setLoading(false);
  };

  const openAssessDialog = async (lim: any) => {
    setAssessDialog(lim);
    setFormOverall(lim.overall_limit?.toString() || lim.limit_amount?.toString() || "");
    setFormRP(lim.limit_receivables_purchase?.toString() || "");
    setFormRF(lim.limit_reverse_factoring?.toString() || "");
    setFormPF(lim.limit_payable_finance?.toString() || "");
    setFormScope(lim.scope || "specific_counterparty");

    // Fetch MSA rates for this org
    const { data: msa } = await supabase
      .from("funder_relationships")
      .select("*")
      .eq("funder_user_id", user!.id)
      .eq("organization_id", lim.organization_id)
      .eq("agreement_status", "active")
      .limit(1);
    setMsaRates(msa?.[0] || null);

    // Fetch anonymized other-funder limits for same borrower
    const { data: otherLimits } = await supabase
      .from("funder_limits")
      .select("overall_limit, limit_receivables_purchase, limit_reverse_factoring, limit_payable_finance, counterparty_name, scope, currency, status")
      .eq("borrower_id", lim.borrower_id)
      .eq("status", "approved")
      .neq("funder_user_id", user!.id);
    setOtherFunderLimits(otherLimits || []);
  };

  const handleApproveLimit = async () => {
    if (!assessDialog || !user) return;
    if (!formOverall && !formRP && !formRF && !formPF) {
      toast.error("Please specify at least one limit amount");
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from("funder_limits").update({
      overall_limit: formOverall ? parseFloat(formOverall) : null,
      limit_amount: parseFloat(formOverall || "0"),
      limit_receivables_purchase: formRP ? parseFloat(formRP) : null,
      limit_reverse_factoring: formRF ? parseFloat(formRF) : null,
      limit_payable_finance: formPF ? parseFloat(formPF) : null,
      scope: formScope,
      status: "approved",
      updated_at: new Date().toISOString(),
    }).eq("id", assessDialog.id);

    if (error) {
       toast.error(error.message);
    } else {
      toast.success("Credit Limit Approved!");
      setAssessDialog(null);
      fetchLimits();
    }
    setSubmitting(false);
  };

  const handleRejectLimit = async () => {
    if (!assessDialog) return;
    setSubmitting(true);
    const { error } = await supabase.from("funder_limits").update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    }).eq("id", assessDialog.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Limit referral declined");
      setAssessDialog(null);
      fetchLimits();
    }
    setSubmitting(false);
  };

  const filtered = limits.filter((lim) =>
    (lim.borrowers?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (lim.counterparty_name || "Global Borrower Limit").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          <p className="text-sm text-muted-foreground">Review limit referrals and manage your funding commitments</p>
        </div>

        {/* MSA Overview */}
        {msas.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" />Master Service Agreements</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs">Originator</TableHead>
                    <TableHead className="text-xs">Base Rate</TableHead>
                    <TableHead className="text-xs">Margin</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {msas.map((msa: any) => (
                    <TableRow key={msa.id}>
                      <TableCell className="text-sm font-medium">{(msa as any).organization?.name || "Originator"}</TableCell>
                      <TableCell className="text-sm">{msa.master_base_rate_type} ({msa.master_base_rate_value || 0}%)</TableCell>
                      <TableCell className="text-sm">+{msa.master_margin_pct}%</TableCell>
                      <TableCell>
                        <Badge variant={msa.agreement_status === "active" ? "default" : msa.agreement_status === "pending" ? "secondary" : "outline"} className="text-xs">
                          {msa.agreement_status === "active" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                          {msa.agreement_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {hasActiveMsa === false && msas.length === 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-5 flex items-start gap-4">
            <ShieldCheck className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300">Master Service Agreement Required</p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                You do not yet have an active MSA with any Originator. Your Originator needs to set up the Master Agreement and rates. Please complete your KYC/KYB onboarding first if you haven't already.
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2"><Clock className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Referrals</p>
                <p className="text-xl font-bold text-foreground">{limits.filter(l => l.status === 'pending').length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Approved Limits</p>
                <p className="text-xl font-bold text-foreground">{limits.filter(l => l.status === 'approved').length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Capital Committed</p>
                <p className="text-xl font-bold text-foreground">
                  £{limits.filter(l => l.status === 'approved').reduce((s, i) => s + Number(i.overall_limit || i.limit_amount || 0), 0).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="gap-1.5">
              Pending Referrals
              {limits.filter(l => l.status === 'pending').length > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{limits.filter(l => l.status === 'pending').length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">My Approved Limits</TabsTrigger>
            <TabsTrigger value="all">All Referrals</TabsTrigger>
          </TabsList>

          {["pending", "approved", "all"].map(tab => {
            const tabLimits = tab === "all" ? limits : limits.filter(l => l.status === (tab === "approved" ? "approved" : "pending"));
            const tabFiltered = tabLimits.filter((lim) =>
              (lim.borrowers?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
              (lim.counterparty_name || "").toLowerCase().includes(search.toLowerCase())
            );
            return (
              <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search Borrowers or Counterparties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Card>
                  <CardContent className="p-0">
                    {loading ? (
                      <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                    ) : tabFiltered.length === 0 ? (
                      <div className="flex flex-col items-center py-12">
                        <ShieldCheck className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">
                          {tab === "pending" ? "No pending limit referrals" : tab === "approved" ? "No approved limits yet" : "No referrals found"}
                        </p>
                        {tab === "pending" && hasActiveMsa && <p className="text-xs text-muted-foreground mt-1">Your Originator will send limit referrals here for you to review and approve.</p>}
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Borrower</TableHead>
                            <TableHead>Scope</TableHead>
                            <TableHead>Currency</TableHead>
                            <TableHead>Overall Limit</TableHead>
                            <TableHead>Rec. Purchase</TableHead>
                            <TableHead>Rev. Factoring</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tabFiltered.map((lim) => (
                            <TableRow key={lim.id}>
                              <TableCell className="font-medium">{lim.borrowers?.company_name || "—"}</TableCell>
                              <TableCell>
                                {lim.counterparty_name ? (
                                  <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs">{lim.counterparty_name}</span>
                                ) : (
                                  <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded text-xs">All Counterparties</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs font-mono">{lim.currency}</TableCell>
                              <TableCell className="font-mono text-xs">{lim.overall_limit ? Number(lim.overall_limit).toLocaleString() : Number(lim.limit_amount || 0).toLocaleString()}</TableCell>
                              <TableCell className="font-mono text-xs">{lim.limit_receivables_purchase ? Number(lim.limit_receivables_purchase).toLocaleString() : "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{lim.limit_reverse_factoring ? Number(lim.limit_reverse_factoring).toLocaleString() : "—"}</TableCell>
                              <TableCell>
                                <Badge variant={lim.status === 'pending' ? "secondary" : lim.status === 'approved' ? "default" : "destructive"} className="text-xs">
                                  {lim.status === 'approved' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : lim.status === 'rejected' ? <XCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                                  {lim.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {lim.status === 'pending' && (
                                  <Button size="sm" onClick={() => openAssessDialog(lim)}>Assess</Button>
                                )}
                                {lim.status === 'approved' && (
                                  <Button size="sm" variant="outline" onClick={() => openAssessDialog(lim)}>View / Edit</Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Assess Dialog */}
      <Dialog open={!!assessDialog} onOpenChange={() => setAssessDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assess Credit Limit</DialogTitle>
            <DialogDescription>
              Assessing limit for <strong className="text-foreground">{assessDialog?.borrowers?.company_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* MSA Rates - Read Only */}
            <div className="bg-muted p-4 rounded-md space-y-2">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> MASTER SERVICE AGREEMENT RATES (Read-Only)</p>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Base Rate Type</Label>
                  <Input value={msaRates?.master_base_rate_type || assessDialog?.base_rate_type || "—"} disabled className="mt-1 bg-muted" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Base Rate Value (%)</Label>
                  <Input value={msaRates?.master_base_rate_value ?? assessDialog?.base_rate_value ?? "—"} disabled className="mt-1 bg-muted" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Funder Margin (%)</Label>
                  <Input value={msaRates?.master_margin_pct ?? assessDialog?.margin_pct ?? "—"} disabled className="mt-1 bg-muted" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Rates governed by Master Service Agreement and cannot be changed at deal level.</p>
            </div>

            {/* Anonymized Other Funder Limits */}
            {otherFunderLimits.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4 rounded-md space-y-2">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Other Funder Approved Limits for This Borrower
                </p>
                {otherFunderLimits.map((ol, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs border-b border-blue-100 dark:border-blue-900 pb-1 last:border-0">
                    <span className="text-blue-600 dark:text-blue-400">Funder {String.fromCharCode(65 + idx)}</span>
                    <span className="font-mono">
                      {ol.currency} {Number(ol.overall_limit || 0).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      {ol.counterparty_name ? `Specific: ${ol.counterparty_name}` : "All Counterparties"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Scope Selector */}
            <div className="space-y-2">
              <Label>Limit Scope</Label>
              <Select value={formScope} onValueChange={setFormScope}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="specific_counterparty">Specific Counterparty (as stated in referral)</SelectItem>
                  <SelectItem value="all_counterparties">All Counterparties for this Borrower</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Per-Product Limit Inputs */}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-3">APPROVED LIMITS (overall and/or per-product)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Overall Limit ({assessDialog?.currency})</Label>
                  <Input type="number" value={formOverall} onChange={(e) => setFormOverall(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Receivables Purchase ({assessDialog?.currency})</Label>
                  <Input type="number" value={formRP} onChange={(e) => setFormRP(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reverse Factoring ({assessDialog?.currency})</Label>
                  <Input type="number" value={formRF} onChange={(e) => setFormRF(e.target.value)} className="font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payable Finance ({assessDialog?.currency})</Label>
                  <Input type="number" value={formPF} onChange={(e) => setFormPF(e.target.value)} className="font-mono" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAssessDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRejectLimit} disabled={submitting}>
              Decline
            </Button>
            <Button onClick={handleApproveLimit} disabled={submitting || (!formOverall && !formRP && !formRF && !formPF)}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve Limit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
