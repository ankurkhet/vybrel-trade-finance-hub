import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Loader2, Search, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Borrowers() {
  const { profile } = useAuth();
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");
  const [regNumber, setRegNumber] = useState("");

  useEffect(() => {
    if (profile?.organization_id) fetchBorrowers();
  }, [profile]);

  const fetchBorrowers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("borrowers")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });

    setBorrowers(data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!companyName || !contactEmail) {
      toast.error("Company name and email are required");
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from("borrowers").insert({
      organization_id: profile.organization_id,
      company_name: companyName,
      contact_email: contactEmail,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      country: country || null,
      industry: industry || null,
      registration_number: regNumber || null,
      onboarding_status: "invited",
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Borrower added successfully");
      setDialogOpen(false);
      resetForm();
      fetchBorrowers();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setCompanyName("");
    setContactEmail("");
    setContactName("");
    setContactPhone("");
    setCountry("");
    setIndustry("");
    setRegNumber("");
  };

  const filtered = borrowers.filter((b) =>
    b.company_name.toLowerCase().includes(search.toLowerCase()) ||
    b.contact_email.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": return "default";
      case "rejected": return "destructive";
      case "under_review": return "secondary";
      default: return "outline";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Borrowers</h1>
            <p className="text-sm text-muted-foreground">Manage borrower relationships and onboarding</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Borrower
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search borrowers..." value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Badge variant="secondary">{filtered.length} borrowers</Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12">
                <Users className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  {search ? "No borrowers match your search" : "No borrowers yet"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>KYC</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Credit Limit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{b.company_name}</p>
                          <p className="text-xs text-muted-foreground">{b.registration_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm text-foreground">{b.contact_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{b.contact_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{b.country || "—"}</TableCell>
                      <TableCell className="text-sm">{b.industry || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={b.kyc_completed ? "default" : "outline"} className="text-xs">
                          {b.kyc_completed ? "Complete" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(b.onboarding_status) as any} className="capitalize text-xs">
                          {b.onboarding_status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.credit_limit ? `$${Number(b.credit_limit).toLocaleString()}` : "—"}
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
            <DialogTitle>Add New Borrower</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp Ltd" />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Industry</Label>
                <Select value={industry} onValueChange={setIndustry}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["Manufacturing", "Retail", "Services", "Technology", "Agriculture", "Construction", "Other"].map((i) => (
                      <SelectItem key={i.toLowerCase()} value={i.toLowerCase()}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Registration #</Label>
                <Input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Borrower
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
