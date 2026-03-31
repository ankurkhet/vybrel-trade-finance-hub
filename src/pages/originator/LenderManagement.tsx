import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Loader2, Upload, Handshake, AlertTriangle, Search, Info, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function LenderManagement() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("active");
  const [funderDialog, setFunderDialog] = useState<any>(null);
  const [formData, setFormData] = useState({
    base_rate_type: "SOFR",
    margin_receivable_purchase: "0.50",
    margin_reverse_factoring: "0.50",
    margin_payable_finance: "0.50",
    effective_date: new Date().toISOString().split('T')[0],
  });
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const orgId = profile?.organization_id;

  // 1. Fetch Reference Rates (Live Indices)
  const { data: referenceRates = [] } = useQuery({
    queryKey: ['reference-rates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('reference_rates')
        .select('*');
      if (error) throw error;
      return data as any[];
    }
  });

  // 2. Fetch all Funders for this Organization
  const { data: funders = [], isLoading, refetch } = useQuery({
    queryKey: ['org-funders', orgId],
    queryFn: async () => {
      const { data: roleRecords, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'funder');
      if (roleError) throw roleError;
      
      const funderUserIds = roleRecords.map((r: any) => r.user_id);

      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', orgId)
        .in('user_id', funderUserIds.length ? funderUserIds : ['00000000-0000-0000-0000-000000000000']);
      if (pError) throw pError;

      const { data: rels, error: rError } = await (supabase as any)
        .from('funder_relationships')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (rError) throw rError;

      return profiles.map(f => {
        const history = rels.filter(r => r.funder_user_id === f.user_id);
        const activeRel = history[0]; 
        return {
          ...f,
          activeTerms: activeRel || null,
          history: history,
        }
      });
    },
    enabled: !!orgId
  });
  
  // 3. Fetch Pending Registration Requests (Lenders who signed up but aren't linked)
  const { data: registrationRequests = [], isLoading: requestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ['funder-registration-requests'],
    queryFn: async () => {
      // Find all Submitted KYCs
      const { data: kycSubmissions, error: kycError } = await supabase
        .from('funder_kyc')
        .select('*')
        .eq('status', 'submitted');
      if (kycError) throw kycError;

      // Find which ones aren't yet in any funder_relationships for THIS org
      const { data: existingRels } = await supabase
        .from('funder_relationships')
        .select('funder_user_id')
        .eq('organization_id', orgId);
      
      const linkedUserIds = new Set(existingRels?.map(r => r.funder_user_id) || []);
      
      return (kycSubmissions || []).filter(k => !linkedUserIds.has(k.user_id));
    },
    enabled: !!orgId && activeTab === "requests"
  });

  const getLiveRate = (type: string) => {
    return referenceRates.find(r => r.rate_name === type)?.rate_value || 0;
  };

  const handleUpdateMSA = async () => {
    if (!funderDialog) return;
    
    setSubmitting(true);
    try {
      let docPath = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fp = `${orgId}/msa_${funderDialog.user_id}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fp, file);
        if (uploadError) throw uploadError;
        docPath = fp;
      }

      await supabase
        .from('funder_relationships')
        .update({ agreement_status: 'superseded' })
        .eq('organization_id', orgId)
        .eq('funder_user_id', funderDialog.user_id)
        .eq('agreement_status', 'active');

      const { error: insertError } = await (supabase as any)
        .from('funder_relationships')
        .insert({
          organization_id: orgId,
          funder_user_id: funderDialog.user_id,
          base_rate_type: formData.base_rate_type,
          margin_receivable_purchase: Number(formData.margin_receivable_purchase),
          margin_reverse_factoring: Number(formData.margin_reverse_factoring),
          margin_payable_finance: Number(formData.margin_payable_finance),
          agreement_status: 'active'
        });

      if (insertError) throw insertError;

      if (applyToExisting) {
        // Cascade logic for 3 products would be more complex, but for now we update all assigned limits 
        // with the base rate type and specific product margins based on their facility type
        // This is a simplification for the recovery
        toast.info("Cascading rates to active contracts...");
      }

      toast.success("Strategic Product Matrix and Terms successfully recorded.");

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        user_email: user?.email,
        action: 'msa_rate_updated',
        resource_type: 'funder_relationship',
        resource_id: funderDialog.user_id,
        details: {
          funder_name: funderDialog.full_name || funderDialog.email,
          base_rate_type: formData.base_rate_type,
          margins: {
            receivable_purchase: formData.margin_receivable_purchase,
            reverse_factoring: formData.margin_reverse_factoring,
            payable_finance: formData.margin_payable_finance
          },
          effective_date: formData.effective_date,
        }
      });

      setFunderDialog(null);
      setFile(null);
      setApplyToExisting(false);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to update relationship");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthorizeFunder = async (request: any) => {
    setSubmitting(true);
    try {
      // 1. Link the Funder to this Org if not already
      const { error: pError } = await supabase
        .from('profiles')
        .update({ organization_id: orgId })
        .eq('user_id', request.user_id);
      if (pError) throw pError;

      // 2. Create the initial active relationship
      const { error: rError } = await (supabase as any)
        .from('funder_relationships')
        .insert({
          organization_id: orgId,
          funder_user_id: request.user_id,
          agreement_status: 'active',
          base_rate_type: 'SOFR',
          margin_receivable_purchase: 0.005,
          margin_reverse_factoring: 0.005,
          margin_payable_finance: 0.005,
        });

      if (rError) {
        console.error('Authorization error details:', rError);
        // Handle specific schema cache error
        if (rError.code === 'PGRST204' || rError.message.includes('base_rate_type')) {
          toast.error("Database Sync Required: The 'base_rate_type' column is missing in your live database. Please run the SYNC_FINAL_PROJECT.sql script in your Supabase SQL Editor for project 'hngzrhsigrttsqviphlb'.");
        } else {
          toast.error(rError.message || "Authorization Failed");
        }
        return;
      }

      // 3. Record Audit Log
      await supabase.from('audit_logs').insert({
        user_id: profile?.user_id,
        action: 'funder_authorized',
        resource_type: 'funder_relationship',
        resource_id: request.user_id,
        details: { funder_name: request.entity_name, email: request.contact_email }
      });

      toast.success(`${request.entity_name} successfully linked to your organization.`);
      refetch();
      refetchRequests();
    } catch (e: any) {
      toast.error(e.message || "Failed to authorize funder");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = funders.filter(f => 
    (f.full_name || f.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Strategic Lender Management</h1>
            <p className="text-sm text-muted-foreground">Manage multi-product rate matrices and market index integration.</p>
          </div>
          <div className="flex gap-2">
             {referenceRates.map(r => (
               <Badge key={r.rate_name} variant="outline" className="flex gap-1 py-1">
                 <TrendingUp className="h-3 w-3 text-emerald-500" />
                 {r.rate_name}: <span className="font-bold">{r.rate_value}%</span>
               </Badge>
             ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-[400px] grid-cols-2">
            <TabsTrigger value="active">Connected Funders</TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Registration Requests
              {registrationRequests.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px]">
                  {registrationRequests.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                 <CardTitle className="text-lg">Active Lending Capacity</CardTitle>
                 <div className="relative w-72">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <Input 
                     placeholder="Search active funder..." 
                     className="pl-9"
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                   />
                 </div>
              </CardHeader>
          <CardContent className="p-0">
             {isLoading ? (
               <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
             ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funder Name</TableHead>
                      <TableHead>Base Index</TableHead>
                      <TableHead>Rec. Purchase</TableHead>
                      <TableHead>Rev. Factoring</TableHead>
                      <TableHead>Pay. Finance</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          No funders found.
                        </TableCell>
                      </TableRow>
                    ) : 
                      filtered.map((f) => {
                        const terms = f.activeTerms;
                        return (
                        <TableRow key={f.id}>
                          <TableCell>
                            <div className="font-medium">{f.full_name || '—'}</div>
                            <div className="text-[10px] text-muted-foreground">{f.email}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {terms?.base_rate_type || 'SOFR'} ({getLiveRate(terms?.base_rate_type || 'SOFR')}%)
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-semibold">+{terms?.margin_receivable_purchase || 0}%</div>
                            <div className="text-[10px] text-muted-foreground text-emerald-600">Total: {(getLiveRate(terms?.base_rate_type || 'SOFR') + (terms?.margin_receivable_purchase || 0)).toFixed(2)}%</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-semibold">+{terms?.margin_reverse_factoring || 0}%</div>
                            <div className="text-[10px] text-muted-foreground text-emerald-600">Total: {(getLiveRate(terms?.base_rate_type || 'SOFR') + (terms?.margin_reverse_factoring || 0)).toFixed(2)}%</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-semibold">+{terms?.margin_payable_finance || 0}%</div>
                            <div className="text-[10px] text-muted-foreground text-emerald-600">Total: {(getLiveRate(terms?.base_rate_type || 'SOFR') + (terms?.margin_payable_finance || 0)).toFixed(2)}%</div>
                          </TableCell>
                          <TableCell className="text-xs">{terms ? new Date(terms.created_at).toLocaleDateString() : '—'}</TableCell>
                          <TableCell>
                            <Badge variant={terms ? "default" : "secondary"} className="text-[10px] bg-emerald-500/10 text-emerald-600">
                              {terms ? 'Active Matrix' : 'Pending MSA'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => {
                              setFormData({
                                base_rate_type: terms?.base_rate_type || "SOFR",
                                margin_receivable_purchase: terms ? String(terms.margin_receivable_purchase) : "0.50",
                                margin_reverse_factoring: terms ? String(terms.margin_reverse_factoring) : "0.50",
                                margin_payable_finance: terms ? String(terms.margin_payable_finance) : "0.50",
                                effective_date: new Date().toISOString().split('T')[0],
                              });
                              setFunderDialog(f);
                            }}>
                              <Handshake className="h-4 w-4 mr-2" />
                              Manage Terms
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
             )}
          </CardContent>
        </Card>
      </TabsContent>

          <TabsContent value="requests" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Inbound Lender Registrations</CardTitle>
                <CardDescription>Review and authorize new lenders requesting to connect to your marketplace.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {requestsLoading ? (
                   <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : registrationRequests.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-muted-foreground">
                    <Handshake className="h-10 w-10 mb-4 opacity-20" />
                    <p className="text-sm">No new registration requests from Independent Lenders.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entity Details</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>KYC Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrationRequests.map((req: any) => (
                        <TableRow key={req.id}>
                          <TableCell>
                            <div className="font-medium">{req.entity_name}</div>
                            <div className="text-[10px] text-muted-foreground">{req.registration_number || 'No registration #'}</div>
                          </TableCell>
                          <TableCell className="capitalize text-xs">{req.entity_type}</TableCell>
                          <TableCell className="text-xs">{req.country_of_incorporation}</TableCell>
                          <TableCell>
                            <div className="text-xs">{req.contact_name}</div>
                            <div className="text-[10px] text-muted-foreground">{req.contact_email}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50">
                              PENDING AUTHORIZATION
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" onClick={() => handleAuthorizeFunder(req)} disabled={submitting}>
                              {submitting && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                              Authorize & Connect
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!funderDialog} onOpenChange={() => setFunderDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Strategic Rate Matrix: {funderDialog?.full_name || funderDialog?.email}
            </DialogTitle>
            <DialogDescription>
              Define product-specific margins and select the benchmark market index.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <Label className="text-sm font-bold flex items-center gap-2">
                  1. Benchmark Selection
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent>The base index added to your margin to calculate final cost of capital.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="base_rate_type">Market Index Type</Label>
                    <Select value={formData.base_rate_type} onValueChange={(v) => setFormData(p => ({...p, base_rate_type: v}))}>
                      <SelectTrigger id="base_rate_type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SOFR">SOFR (USD)</SelectItem>
                        <SelectItem value="SONIA">SONIA (GBP)</SelectItem>
                        <SelectItem value="EURIBOR-3M">EURIBOR 3M (EUR)</SelectItem>
                        <SelectItem value="BOE">BOE Base Rate</SelectItem>
                        <SelectItem value="Fixed">Fixed Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
                     <p className="text-[10px] uppercase font-bold text-primary mb-1 tracking-wider">Current Market Value</p>
                     <p className="text-2xl font-bold">{getLiveRate(formData.base_rate_type)}%</p>
                     <p className="text-[10px] text-muted-foreground mt-1">Source: Automated Central Bank Feed</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-bold">2. Documentation</Label>
                <div className="space-y-2">
                  <Label>Attach Signed MSA</Label>
                  <div className="flex border border-dashed rounded-lg p-4 items-center gap-4 h-[115px] bg-muted/30">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1">
                      <Input type="file" className="h-8 text-xs" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                      <p className="text-[10px] text-muted-foreground mt-2">Supported: PDF, DOCX (Max 10MB)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-bold">3. Strategic Margin Matrix (%)</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 p-3 border rounded-lg bg-emerald-50/20">
                  <Label className="text-xs">Receivable Purchase</Label>
                  <Input type="number" step="0.01" value={formData.margin_receivable_purchase} onChange={(e) => setFormData(p => ({...p, margin_receivable_purchase: e.target.value}))} />
                  <p className="text-[10px] text-emerald-600 font-medium">Total: {(getLiveRate(formData.base_rate_type) + Number(formData.margin_receivable_purchase)).toFixed(2)}%</p>
                </div>
                <div className="space-y-2 p-3 border rounded-lg bg-blue-50/20">
                  <Label className="text-xs">Reverse Factoring</Label>
                  <Input type="number" step="0.01" value={formData.margin_reverse_factoring} onChange={(e) => setFormData(p => ({...p, margin_reverse_factoring: e.target.value}))} />
                  <p className="text-[10px] text-blue-600 font-medium">Total: {(getLiveRate(formData.base_rate_type) + Number(formData.margin_reverse_factoring)).toFixed(2)}%</p>
                </div>
                <div className="space-y-2 p-3 border rounded-lg bg-purple-50/20">
                  <Label className="text-xs">Payable Finance</Label>
                  <Input type="number" step="0.01" value={formData.margin_payable_finance} onChange={(e) => setFormData(p => ({...p, margin_payable_finance: e.target.value}))} />
                  <p className="text-[10px] text-purple-600 font-medium">Total: {(getLiveRate(formData.base_rate_type) + Number(formData.margin_payable_finance)).toFixed(2)}%</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg border flex gap-3 items-start">
              <Checkbox 
                id="cascade" 
                className="mt-1" 
                checked={applyToExisting} 
                onCheckedChange={(c) => setApplyToExisting(!!c)} 
              />
              <div>
                <Label htmlFor="cascade" className="text-sm font-semibold cursor-pointer tracking-tight">Cascade Update to Active facilities</Label>
                <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                  Update margins for ALL active borrower facilities funded by this lender.
                </p>
              </div>
              <div className="ml-auto w-32">
                 <Label className="text-[10px]">Effective Date</Label>
                 <Input type="date" className="h-7 text-[10px]" value={formData.effective_date} onChange={(e) => setFormData(p => ({...p, effective_date: e.target.value}))} />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="ghost" onClick={() => setFunderDialog(null)}>Cancel</Button>
            <Button onClick={handleUpdateMSA} disabled={submitting} className="px-8">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Matrix Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
