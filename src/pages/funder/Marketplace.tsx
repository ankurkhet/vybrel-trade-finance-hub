import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote, Loader2, Search, TrendingUp, Clock, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function FunderMarketplace() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fundDialog, setFundDialog] = useState<any>(null);
  const [offerAmount, setOfferAmount] = useState("");
  const [discountRate, setDiscountRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAvailable();
    // Subscribe to realtime invoice updates
    const channel = supabase
      .channel("marketplace-invoices")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        fetchAvailable();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAvailable = async () => {
    setLoading(true);
    // Get approved invoices available for funding
    const { data } = await supabase
      .from("invoices")
      .select("*, borrowers(company_name)")
      .eq("status", "approved")
      .order("due_date", { ascending: true });

    setInvoices(data || []);
    setLoading(false);
  };

  const handleFund = async () => {
    if (!fundDialog || !offerAmount || !user) return;
    setSubmitting(true);

    const { error } = await supabase.from("funding_offers" as any).insert({
      invoice_id: fundDialog.id,
      funder_user_id: user.id,
      organization_id: fundDialog.organization_id,
      offer_amount: parseFloat(offerAmount),
      discount_rate: discountRate ? parseFloat(discountRate) : null,
      status: "pending",
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Funding offer submitted!");
      setFundDialog(null);
      setOfferAmount("");
      setDiscountRate("");
    }
    setSubmitting(false);
  };

  const filtered = invoices.filter((inv) =>
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.debtor_name.toLowerCase().includes(search.toLowerCase()) ||
    ((inv.borrowers as any)?.company_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const daysUntilDue = (dueDate: string) => {
    const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoice Marketplace</h1>
          <p className="text-sm text-muted-foreground">Browse approved invoices available for funding</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Banknote className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Available Invoices</p>
                <p className="text-xl font-bold text-foreground">{invoices.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Value</p>
                <p className="text-xl font-bold text-foreground">
                  ${invoices.reduce((s, i) => s + Number(i.amount), 0).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2"><Clock className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Avg. Days to Due</p>
                <p className="text-xl font-bold text-foreground">
                  {invoices.length > 0
                    ? Math.round(invoices.reduce((s, i) => s + daysUntilDue(i.due_date), 0) / invoices.length)
                    : 0}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoices..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <Banknote className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No invoices available for funding</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Debtor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const days = daysUntilDue(inv.due_date);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{(inv.borrowers as any)?.company_name || "—"}</TableCell>
                        <TableCell>{inv.debtor_name}</TableCell>
                        <TableCell className="font-medium">{inv.currency} {Number(inv.amount).toLocaleString()}</TableCell>
                        <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={days < 14 ? "destructive" : days < 30 ? "secondary" : "outline"} className="text-xs">
                            {days}d
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => {
                            setFundDialog(inv);
                            setOfferAmount(inv.amount.toString());
                          }}>
                            <TrendingUp className="mr-1.5 h-3 w-3" /> Fund
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

      {/* Fund Dialog */}
      <Dialog open={!!fundDialog} onOpenChange={() => setFundDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Funding Offer</DialogTitle>
            <DialogDescription>
              {fundDialog?.invoice_number} — {fundDialog?.debtor_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Amount</span>
                <span className="font-medium text-foreground">{fundDialog?.currency} {Number(fundDialog?.amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="text-foreground">{fundDialog?.due_date ? new Date(fundDialog.due_date).toLocaleDateString() : ""}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Offer Amount *</Label>
                <Input type="number" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Discount Rate (%)</Label>
                <Input type="number" step="0.1" value={discountRate} onChange={(e) => setDiscountRate(e.target.value)} placeholder="e.g. 2.5" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFundDialog(null)}>Cancel</Button>
            <Button onClick={handleFund} disabled={submitting || !offerAmount}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
