import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Loader2, Search, Link2, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Counterparties() {
  const { profile } = useAuth();
  const [counterparties, setCounterparties] = useState<any[]>([]);
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedCP, setSelectedCP] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [country, setCountry] = useState("");
  const [regNumber, setRegNumber] = useState("");

  // Link form
  const [linkBorrowerId, setLinkBorrowerId] = useState("");

  const orgId = profile?.organization_id;

  useEffect(() => {
    if (orgId) fetchAll();
  }, [orgId]);

  const fetchAll = async () => {
    setLoading(true);
    const [cpRes, bRes, linkRes] = await Promise.all([
      supabase.from("counterparties").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("borrowers").select("id, company_name").eq("organization_id", orgId),
      supabase.from("borrower_counterparties").select("*, borrowers(company_name), counterparties(company_name)").eq("organization_id", orgId),
    ]);
    setCounterparties(cpRes.data || []);
    setBorrowers(bRes.data || []);
    setLinks(linkRes.data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!companyName || !contactEmail) { toast.error("Company name and email are required"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("counterparties").insert({
      organization_id: orgId,
      company_name: companyName,
      contact_email: contactEmail,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      country: country || null,
      registration_number: regNumber || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Counterparty added"); setDialogOpen(false); resetForm(); fetchAll(); }
    setSubmitting(false);
  };

  const handleLink = async () => {
    if (!linkBorrowerId || !selectedCP) return;
    setSubmitting(true);
    const { error } = await supabase.from("borrower_counterparties").insert({
      borrower_id: linkBorrowerId,
      counterparty_id: selectedCP.id,
      organization_id: orgId,
    });
    if (error) {
      if (error.code === "23505") toast.error("This link already exists");
      else toast.error(error.message);
    } else { toast.success("Link created"); setLinkDialogOpen(false); fetchAll(); }
    setSubmitting(false);
  };

  const handleUnlink = async (linkId: string) => {
    const { error } = await supabase.from("borrower_counterparties").delete().eq("id", linkId);
    if (error) toast.error(error.message);
    else { toast.success("Link removed"); fetchAll(); }
  };

  const resetForm = () => {
    setCompanyName(""); setContactEmail(""); setContactName("");
    setContactPhone(""); setCountry(""); setRegNumber("");
  };

  const filtered = counterparties.filter((c) =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_email.toLowerCase().includes(search.toLowerCase())
  );

  const getLinkedBorrowers = (cpId: string) =>
    links.filter((l) => l.counterparty_id === cpId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Counterparties</h1>
            <p className="text-sm text-muted-foreground">Manage counterparties and link them to borrowers</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add Counterparty</Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search counterparties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Badge variant="secondary">{filtered.length} counterparties</Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <Users className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">{search ? "No counterparties match" : "No counterparties yet"}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Linked Borrowers</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((cp) => {
                    const cpLinks = getLinkedBorrowers(cp.id);
                    return (
                      <TableRow key={cp.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{cp.company_name}</p>
                          <p className="text-xs text-muted-foreground">{cp.registration_number}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-foreground">{cp.contact_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{cp.contact_email}</p>
                        </TableCell>
                        <TableCell className="text-sm">{cp.country || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {cpLinks.length === 0 ? (
                              <span className="text-xs text-muted-foreground">None</span>
                            ) : cpLinks.map((l) => (
                              <Badge key={l.id} variant="outline" className="text-xs gap-1">
                                {(l.borrowers as any)?.company_name}
                                <button onClick={() => handleUnlink(l.id)} className="ml-1 hover:text-destructive">
                                  <Unlink className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedCP(cp); setLinkDialogOpen(true); }}>
                            <Link2 className="mr-1 h-3 w-3" /> Link Borrower
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

      {/* Add Counterparty Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add New Counterparty</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Counterparty Ltd" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Email *</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Registration #</Label>
              <Input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Counterparty
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Borrower Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link Borrower to {selectedCP?.company_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Borrower</Label>
              <Select value={linkBorrowerId} onValueChange={setLinkBorrowerId}>
                <SelectTrigger><SelectValue placeholder="Choose a borrower" /></SelectTrigger>
                <SelectContent>
                  {borrowers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleLink} disabled={submitting || !linkBorrowerId}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
