import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export function FunderLimitsTab({ borrowerId, organizationId }: { borrowerId: string, organizationId: string }) {
  const [limits, setLimits] = useState<any[]>([]);
  const [funders, setFunders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [referDialog, setReferDialog] = useState(false);
  const [formData, setFormData] = useState({
    funder_user_id: "",
    counterparty_name: "", // optional
    limit_amount: "",
    currency: "GBP",
    base_rate_type: "Fixed Rate",
    base_rate_value: "",
    margin_pct: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchFunders();
    fetchLimits();
  }, [borrowerId]);

  const fetchFunders = async () => {
    // Only fetch funders in the same organization
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("role", "funder")
      .eq("organization_id", organizationId);
    if (data) setFunders(data);
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

  const handleRefer = async () => {
    if (!formData.funder_user_id || !formData.limit_amount) {
      toast.error("Funder and Requested Limit Amount are required");
      return;
    }
    setSubmitting(true);
    const payload = {
      organization_id: organizationId,
      borrower_id: borrowerId,
      funder_user_id: formData.funder_user_id,
      counterparty_name: formData.counterparty_name || null,
      limit_amount: parseFloat(formData.limit_amount),
      currency: formData.currency,
      base_rate_type: formData.base_rate_type,
      base_rate_value: parseFloat(formData.base_rate_value || "0"),
      margin_pct: parseFloat(formData.margin_pct || "0"),
      status: "pending"
    };

    const { error } = await supabase.from("funder_limits").insert(payload);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Limit Request referred to Funder");
      setReferDialog(false);
      setFormData({
        funder_user_id: "", counterparty_name: "", limit_amount: "", currency: "GBP",
        base_rate_type: "Fixed Rate", base_rate_value: "", margin_pct: ""
      });
      fetchLimits();
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <div>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Funder Limit Allocations</CardTitle>
          <CardDescription>Manage referred credit limits spanning this Borrower and their Counterparties</CardDescription>
        </div>
        <Button size="sm" onClick={() => setReferDialog(true)}><Plus className="h-4 w-4 mr-2" /> Request Funder Limit</Button>
      </CardHeader>
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
                <TableHead>Amount</TableHead>
                <TableHead>Requested Index Rate</TableHead>
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
                        Global Borrower Limit
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">{l.currency} {Number(l.limit_amount).toLocaleString()}</TableCell>
                  <TableCell>{l.base_rate_type} + {l.margin_pct}% Mgn</TableCell>
                  <TableCell>
                    <Badge variant={l.status === 'pending' ? "secondary" : l.status === 'approved' ? "outline" : "destructive"}>
                      {l.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={referDialog} onOpenChange={setReferDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Refer Limit to Funder</DialogTitle>
            <DialogDescription>
              Submit a requested exposure profile to a Funder for assessment. Internal Originator margins are kept completely hidden.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Select Funder *</Label>
              <Select value={formData.funder_user_id} onValueChange={(val) => setFormData(f => ({...f, funder_user_id: val}))}>
                <SelectTrigger><SelectValue placeholder="Choose funder..." /></SelectTrigger>
                <SelectContent>
                  {funders.length === 0 && <SelectItem value="none" disabled>No active funders</SelectItem>}
                  {funders.map(f => <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Counterparty Restraint (Optional)</Label>
              <Input 
                placeholder="Leave blank for Global Borrower Limit" 
                value={formData.counterparty_name} 
                onChange={(e) => setFormData(f => ({...f, counterparty_name: e.target.value}))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Requested Limit Amount *</Label>
              <Input 
                type="number" 
                value={formData.limit_amount} 
                onChange={(e) => setFormData(f => ({...f, limit_amount: e.target.value}))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Base Rate Type</Label>
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
              <Label>Base Rate Value (%)</Label>
              <Input 
                type="number" step="0.01" 
                value={formData.base_rate_value} 
                onChange={(e) => setFormData(f => ({...f, base_rate_value: e.target.value}))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Funder Margin (%)</Label>
              <Input 
                type="number" step="0.01" 
                value={formData.margin_pct} 
                onChange={(e) => setFormData(f => ({...f, margin_pct: e.target.value}))} 
              />
            </div>
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
