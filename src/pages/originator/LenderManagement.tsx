import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Loader2, Upload, Handshake, AlertTriangle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export default function LenderManagement() {
  const { profile } = useAuth();
  const [funderDialog, setFunderDialog] = useState<any>(null);
  const [formData, setFormData] = useState({
    master_base_rate_type: "Fixed Rate",
    master_base_rate_value: "",
    master_margin_pct: "",
    effective_date: new Date().toISOString().split('T')[0],
  });
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const orgId = profile?.organization_id;

  // 1. Fetch all expected Funders for this Organization
  const { data: funders = [], isLoading, refetch } = useQuery({
    queryKey: ['org-funders', orgId],
    queryFn: async () => {
      // Get all Funder Profiles
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', orgId)
        .eq('role', 'funder');
      if (pError) throw pError;

      // Get Master Rate histories mapping to those Funders
      const { data: rels, error: rError } = await supabase
        .from('funder_relationships')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (rError) throw rError;

      // Map the active relationship (first created) to the profles
      return profiles.map(f => {
        const history = rels.filter(r => r.funder_user_id === f.user_id);
        const activeRel = history[0]; // newest
        return {
          ...f,
          activeTerms: activeRel || null,
          history: history,
        }
      });
    },
    enabled: !!orgId
  });

  const handleUpdateMSA = async () => {
    if (!funderDialog) return;
    if (!formData.master_base_rate_value || !formData.master_margin_pct) {
      toast.error('Please input valid rates and margins.');
      return;
    }

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

      // 1. Insert the new MSA/Terms
      const { error: insertError } = await supabase
        .from('funder_relationships')
        .insert({
          organization_id: orgId,
          funder_user_id: funderDialog.user_id,
          master_base_rate_type: formData.master_base_rate_type,
          master_base_rate_value: Number(formData.master_base_rate_value),
          master_margin_pct: Number(formData.master_margin_pct),
          effective_date: formData.effective_date,
          agreement_document_path: docPath,
          agreement_status: 'active'
        });

      if (insertError) throw insertError;

      // 2. Potentially Cascade to existing `funder_limits`
      if (applyToExisting) {
        const { error: cascadeError } = await supabase
          .from('funder_limits')
          .update({
             base_rate_type: formData.master_base_rate_type,
             base_rate_value: Number(formData.master_base_rate_value),
             margin_pct: Number(formData.master_margin_pct),
          })
          .eq('organization_id', orgId)
          .eq('funder_user_id', funderDialog.user_id)
          .eq('status', 'approved'); // Only update active ones
          
        if (cascadeError) throw cascadeError;
        toast.success("Active borrower limits updated to reflect new Master Rates!");
      }

      toast.success("Master Agreement and Terms successfully recorded.");
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

  const filtered = funders.filter(f => 
    (f.full_name || f.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lender Management</h1>
            <p className="text-sm text-muted-foreground">Manage Master Service Agreements and Global Rate configurations for your Funders.</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-4">
             <CardTitle className="text-lg">Connected Funders</CardTitle>
             <div className="relative w-72">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input 
                 placeholder="Search funder..." 
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
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Funder Name</TableHead>
                     <TableHead>Email</TableHead>
                     <TableHead>Active Base Rate</TableHead>
                     <TableHead>Margin</TableHead>
                     <TableHead>Total Rate</TableHead>
                     <TableHead>Effective From</TableHead>
                     <TableHead>MSA Status</TableHead>
                     <TableHead className="text-right">Action</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {filtered.length === 0 ? (
                     <TableRow>
                       <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                         No funders found. Invite funders via 'Invite Users'.
                       </TableCell>
                     </TableRow>
                   ) : 
                     filtered.map((f) => {
                       const terms = f.activeTerms;
                       const totalRate = terms ? (Number(terms.master_base_rate_value) + Number(terms.master_margin_pct)).toFixed(2) : '—';
                       return (
                       <TableRow key={f.id}>
                         <TableCell className="font-medium">{f.full_name || '—'}</TableCell>
                         <TableCell className="text-muted-foreground text-sm">{f.email}</TableCell>
                         <TableCell>{terms ? `${terms.master_base_rate_type} (${terms.master_base_rate_value}%)` : '—'}</TableCell>
                         <TableCell>{terms ? `${terms.master_margin_pct}%` : '—'}</TableCell>
                         <TableCell className="font-semibold text-primary">{terms ? `${totalRate}%` : '—'}</TableCell>
                         <TableCell>{terms ? new Date(terms.effective_date).toLocaleDateString() : '—'}</TableCell>
                         <TableCell>
                           {terms ? (
                             <Badge variant="default" className="text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">Configured</Badge>
                           ) : (
                             <Badge variant="secondary" className="text-xs">Pending MSA</Badge>
                           )}
                         </TableCell>
                         <TableCell className="text-right">
                           <Button size="sm" variant="outline" onClick={() => {
                             setFormData({
                               master_base_rate_type: terms ? terms.master_base_rate_type : "Fixed Rate",
                               master_base_rate_value: terms ? String(terms.master_base_rate_value) : "",
                               master_margin_pct: terms ? String(terms.master_margin_pct) : "",
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
             )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!funderDialog} onOpenChange={() => setFunderDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Master Agreement Terms</DialogTitle>
            <DialogDescription>
              Define the global terms and rates for <strong>{funderDialog?.full_name || funderDialog?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Attach Master Service Agreement (Optional)</Label>
              <div className="flex border border-dashed rounded-lg p-4 items-center gap-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <Input type="file" className="h-8" accept=".pdf,.docx,.doc" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Rate Type</Label>
                <Select value={formData.master_base_rate_type} onValueChange={(v) => setFormData(p => ({...p, master_base_rate_type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fixed Rate">Fixed Rate</SelectItem>
                    <SelectItem value="SOFR">SOFR</SelectItem>
                    <SelectItem value="SONIA">SONIA</SelectItem>
                    <SelectItem value="EURIBOR">EURIBOR</SelectItem>
                    <SelectItem value="ESTR">ESTR</SelectItem>
                    <SelectItem value="BOE">BOE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Base Rate Value (%)</Label>
                <Input type="number" step="0.01" value={formData.master_base_rate_value} onChange={(e) => setFormData(p => ({...p, master_base_rate_value: e.target.value}))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>MSA Margin (%)</Label>
                <Input type="number" step="0.01" value={formData.master_margin_pct} onChange={(e) => setFormData(p => ({...p, master_margin_pct: e.target.value}))} />
              </div>
              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input type="date" value={formData.effective_date} onChange={(e) => setFormData(p => ({...p, effective_date: e.target.value}))} />
              </div>
            </div>

            <div className="bg-muted/50 p-4 rounded-lg mt-4 border flex gap-3 items-start">
              <Checkbox 
                id="cascade" 
                className="mt-1" 
                checked={applyToExisting} 
                onCheckedChange={(c) => setApplyToExisting(!!c)} 
              />
              <div>
                <Label htmlFor="cascade" className="text-sm font-semibold cursor-pointer">Synchronize Existing Contracts</Label>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  If selected, the system will instantly cascade these updated limits to all currently active borrower facilities funded by this lender. Leaving this unchecked means existing exposure maintains its legacy rates.
                </p>
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFunderDialog(null)}>Cancel</Button>
            <Button onClick={handleUpdateMSA} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save New Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
