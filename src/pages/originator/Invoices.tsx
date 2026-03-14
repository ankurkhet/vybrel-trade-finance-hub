import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Loader2, Search, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Invoices() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewInvoice, setReviewInvoice] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (profile?.organization_id) fetchInvoices();
  }, [profile]);

  const fetchInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*, borrowers(company_name)")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    setInvoices(data || []);
    setLoading(false);
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setUpdating(true);
    const { error } = await supabase
      .from("invoices")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) toast.error(error.message);
    else {
      toast.success(`Invoice ${newStatus}`);
      setReviewInvoice(null);
      fetchInvoices();
    }
    setUpdating(false);
  };

  const filtered = invoices.filter((inv) => {
    const matchSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.debtor_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusColor = (s: string): string => {
    switch (s) {
      case "approved": return "default";
      case "funded": return "default";
      case "rejected": return "destructive";
      case "under_review": return "secondary";
      default: return "outline";
    }
  };

  const stats = {
    total: invoices.length,
    pending: invoices.filter((i) => i.status === "pending").length,
    approved: invoices.filter((i) => i.status === "approved").length,
    totalValue: invoices.reduce((sum, i) => sum + Number(i.amount), 0),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">Review and manage borrower invoices</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Total Invoices", value: stats.total },
            { label: "Pending Review", value: stats.pending },
            { label: "Approved", value: stats.approved },
            { label: "Total Value", value: `$${stats.totalValue.toLocaleString()}` },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="funded">Funded</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <CreditCard className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No invoices found</p>
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
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{(inv.borrowers as any)?.company_name || "—"}</TableCell>
                      <TableCell>{inv.debtor_name}</TableCell>
                      <TableCell>{inv.currency} {Number(inv.amount).toLocaleString()}</TableCell>
                      <TableCell>{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={statusColor(inv.status) as any} className="capitalize text-xs">
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {inv.status === "pending" && (
                            <>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600"
                                onClick={() => handleStatusUpdate(inv.id, "approved")}>
                                <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
                                onClick={() => handleStatusUpdate(inv.id, "rejected")}>
                                <XCircle className="mr-1 h-3 w-3" /> Reject
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="h-7"
                            onClick={() => setReviewInvoice(inv)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!reviewInvoice} onOpenChange={() => setReviewInvoice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>{reviewInvoice?.invoice_number}</DialogDescription>
          </DialogHeader>
          {reviewInvoice && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Debtor:</span> <span className="text-foreground font-medium">{reviewInvoice.debtor_name}</span></div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="text-foreground font-medium">{reviewInvoice.currency} {Number(reviewInvoice.amount).toLocaleString()}</span></div>
                <div><span className="text-muted-foreground">Issue Date:</span> <span className="text-foreground">{new Date(reviewInvoice.issue_date).toLocaleDateString()}</span></div>
                <div><span className="text-muted-foreground">Due Date:</span> <span className="text-foreground">{new Date(reviewInvoice.due_date).toLocaleDateString()}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusColor(reviewInvoice.status) as any} className="capitalize text-xs ml-1">{reviewInvoice.status}</Badge></div>
                {reviewInvoice.match_score && <div><span className="text-muted-foreground">Match Score:</span> <span className="text-foreground">{reviewInvoice.match_score}%</span></div>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewInvoice(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
