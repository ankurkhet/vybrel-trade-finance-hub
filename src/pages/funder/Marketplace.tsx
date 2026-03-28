import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Loader2, Search, TrendingUp, DollarSign, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function LimitAssessment() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assessDialog, setAssessDialog] = useState<any>(null);
  const [limitAmount, setLimitAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    
    // Fetch limits referred to this Funder
    const { data, error } = await (supabase
      .from("funder_limits" as any) as any)
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

  const handleApproveLimit = async () => {
    if (!assessDialog || !limitAmount || !user) return;
    setSubmitting(true);

    const { error } = await (supabase.from("funder_limits" as any) as any).update({
      limit_amount: parseFloat(limitAmount),
      status: "approved",
      updated_at: new Date().toISOString(),
    }).eq("id", assessDialog.id);

    if (error) {
       toast.error(error.message);
    } else {
      toast.success("Credit Limit Approved and Locked!");
      setAssessDialog(null);
      setLimitAmount("");
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
          <h1 className="text-2xl font-bold text-foreground">Limit Assessment</h1>
          <p className="text-sm text-muted-foreground">Review and approve credit limit referrals from Originators</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><ShieldCheck className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Pending Referrals</p>
                <p className="text-xl font-bold text-foreground">
                  {limits.filter(l => l.status === 'pending').length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Capital Deployed</p>
                <p className="text-xl font-bold text-foreground">
                  ${limits.filter(l => l.status === 'approved').reduce((s, i) => s + Number(i.limit_amount || 0), 0).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search Borrowers or Counterparties..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <ShieldCheck className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No pending limit referrals to assess</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Limit Target (Counterparty)</TableHead>
                    <TableHead>Indexing Rate</TableHead>
                    <TableHead>Requested / Approved Limit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lim) => (
                    <TableRow key={lim.id}>
                      <TableCell className="font-medium">{lim.borrowers?.company_name || "—"}</TableCell>
                      <TableCell>
                        {lim.counterparty_name ? (
                          <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 text-xs font-semibold">
                            {lim.counterparty_name}
                          </span>
                        ) : (
                          <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded-md border border-purple-100 text-xs font-semibold">
                            Global Borrower Limit
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{lim.base_rate_type}</span> + {lim.margin_pct}% Mgn
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {lim.currency} {Number(lim.limit_amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={lim.status === 'pending' ? "secondary" : lim.status === 'approved' ? "outline" : "destructive"}>
                          {lim.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lim.status === 'pending' && (
                          <Button size="sm" onClick={() => {
                            setAssessDialog(lim);
                            setLimitAmount(lim.limit_amount?.toString() || "");
                          }}>
                            Assess Limit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Assess Dialog */}
      <Dialog open={!!assessDialog} onOpenChange={() => setAssessDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Credit Limit</DialogTitle>
            <DialogDescription>
              Assigning limit for <strong className="text-foreground">{assessDialog?.borrowers?.company_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted p-4 rounded-md space-y-2">
               <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Target Scope</span>
                  <span className="font-semibold text-foreground">
                     {assessDialog?.counterparty_name || "Global Borrower Limit"}
                  </span>
               </div>
               <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Originator Indexing Rate</span>
                  <span className="font-semibold text-foreground">
                     {assessDialog?.base_rate_type} + {assessDialog?.margin_pct}% Mgn = Total Funder Return
                  </span>
               </div>
            </div>
            
            <p className="text-xs text-muted-foreground italic mb-2">Note: As per master contract, all base rates and margins are read-only and established by the Originator configuration.</p>

            <div className="space-y-2 pt-2 border-t">
              <Label>Approved Limit Amount ({assessDialog?.currency}) *</Label>
              <Input 
                type="number" 
                value={limitAmount} 
                onChange={(e) => setLimitAmount(e.target.value)} 
                className="font-mono text-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssessDialog(null)}>Cancel</Button>
            <Button onClick={handleApproveLimit} disabled={submitting || !limitAmount}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve Limit Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
