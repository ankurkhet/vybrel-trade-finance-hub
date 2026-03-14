import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Contracts() {
  const { profile } = useAuth();
  const [contracts, setContracts] = useState<any[]>([]);
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [borrowerId, setBorrowerId] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (profile?.organization_id) fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    const [contractsRes, borrowersRes] = await Promise.all([
      supabase.from("contracts").select("*, borrowers(company_name)")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false }),
      supabase.from("borrowers").select("id, company_name")
        .eq("organization_id", profile.organization_id),
    ]);
    setContracts(contractsRes.data || []);
    setBorrowers(borrowersRes.data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!title || !borrowerId) {
      toast.error("Title and borrower are required");
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from("contracts").insert({
      organization_id: profile.organization_id,
      borrower_id: borrowerId,
      title,
      counterparty: counterparty || null,
      contract_value: contractValue ? parseFloat(contractValue) : null,
      currency,
      start_date: startDate || null,
      end_date: endDate || null,
      status: "active",
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Contract created");
      setDialogOpen(false);
      resetForm();
      fetchData();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setTitle("");
    setBorrowerId("");
    setCounterparty("");
    setContractValue("");
    setCurrency("USD");
    setStartDate("");
    setEndDate("");
  };

  const filtered = contracts.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.counterparty || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contracts</h1>
            <p className="text-sm text-muted-foreground">Manage borrower contracts and agreements</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Contract
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search contracts..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Badge variant="secondary">{filtered.length} contracts</Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No contracts found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Counterparty</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{c.title}</p>
                          {c.contract_number && <p className="text-xs text-muted-foreground">{c.contract_number}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{(c.borrowers as any)?.company_name || "—"}</TableCell>
                      <TableCell>{c.counterparty || "—"}</TableCell>
                      <TableCell>
                        {c.contract_value ? `${c.currency} ${Number(c.contract_value).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.start_date ? new Date(c.start_date).toLocaleDateString() : "—"}
                        {c.end_date ? ` — ${new Date(c.end_date).toLocaleDateString()}` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize text-xs">
                          {c.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Contract</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Supply Agreement 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Borrower *</Label>
                <Select value={borrowerId} onValueChange={setBorrowerId}>
                  <SelectTrigger><SelectValue placeholder="Select borrower" /></SelectTrigger>
                  <SelectContent>
                    {borrowers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Counterparty</Label>
                <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contract Value</Label>
                <Input type="number" value={contractValue} onChange={(e) => setContractValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
