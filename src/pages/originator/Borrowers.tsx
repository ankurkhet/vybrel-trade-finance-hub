import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Loader2, Search, Eye, Send, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CompanyInfoStep } from "@/components/onboarding/CompanyInfoStep";
import { DirectorsStep } from "@/components/onboarding/DirectorsStep";
import { emptyCompanyForm, COUNTRIES } from "@/lib/onboarding-types";
import type { CompanyFormData, DirectorData } from "@/lib/onboarding-types";

export default function Borrowers() {
  const navigate = useNavigate();
  const { profile, user, isBroker } = useAuth();
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyFormData>({ ...emptyCompanyForm });
  const [directors, setDirectors] = useState<DirectorData[]>([]);
  const [lookingUp, setLookingUp] = useState(false);

  const handleRegistryLookup = async () => {
    if ((!companyData.registration_number && !companyData.company_name) || !companyData.country) {
      toast.error("Enter a company name or registration number, and select a country first");
      return;
    }
    setLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("registry-lookup", {
        body: {
          country_code: companyData.country,
          registration_number: companyData.registration_number,
          company_name: companyData.company_name || undefined,
        },
      });
      if (error) throw error;
      if (data?.message && (!data.results || data.results.length === 0)) {
        toast.warning(data.message);
      } else if (data?.results?.[0]?.company) {
        const c = data.results[0].company;
        setCompanyData(prev => ({
          ...prev,
          company_name: c.company_name || prev.company_name,
          registered_address: c.registered_address || prev.registered_address,
          incorporation_date: c.incorporation_date || prev.incorporation_date,
          sic_codes: (c.sic_codes || []).join(", ") || prev.sic_codes,
          vat_tax_id: c.vat_tax_id || prev.vat_tax_id,
          trading_name: c.trading_name || prev.trading_name,
        }));
        toast.success("Company details pre-filled from registry");
      } else {
        toast.info("No match found in registry");
      }
    } catch (err: any) {
      toast.error(err.message || "Registry lookup failed");
    }
    setLookingUp(false);
  };

  useEffect(() => {
    if (profile?.organization_id) {
      fetchBorrowers();
    } else if (profile) {
      // Profile loaded but no organization_id
      setLoading(false);
    }
  }, [profile]);

  const fetchBorrowers = async () => {
    if (!profile?.organization_id) {
      setLoading(false);
      return;
    }
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
    if (!companyData.company_name || !companyData.contact_email) {
      toast.error("Company name and email are required");
      return;
    }
    if (!companyData.country) {
      toast.error("Country is required");
      return;
    }
    if (!profile?.organization_id) {
      toast.error("No organization assigned to your account. Please contact an administrator.");
      return;
    }
    setSubmitting(true);

    const { data: newBorrower, error } = await supabase.from("borrowers").insert({
      organization_id: profile.organization_id,
      ...(isBroker && user?.id ? { broker_user_id: user.id } : {}),
      company_name: companyData.company_name,
      trading_name: companyData.trading_name || null,
      contact_email: companyData.contact_email,
      contact_name: companyData.contact_name || null,
      contact_phone: companyData.phone || null,
      phone: companyData.phone || null,
      country: companyData.country || null,
      industry: companyData.industry || null,
      registration_number: companyData.registration_number || null,
      incorporation_date: companyData.incorporation_date || null,
      registered_address: companyData.registered_address as any,
      trading_address: companyData.trading_address as any,
      website: companyData.website || null,
      vat_tax_id: companyData.vat_tax_id || null,
      num_employees: companyData.num_employees ? parseInt(companyData.num_employees) : null,
      annual_turnover: companyData.annual_turnover ? parseFloat(companyData.annual_turnover) : null,
      onboarding_status: "invited" as const,
    }).select("id").single();

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    if (newBorrower && directors.length > 0) {
      const { error: dirError } = await supabase.from("borrower_directors").insert(
        directors.map(d => ({
          borrower_id: newBorrower.id,
          organization_id: profile.organization_id,
          first_name: d.first_name,
          middle_name: d.middle_name || null,
          last_name: d.last_name,
          date_of_birth: d.date_of_birth || null,
          nationality: d.nationality || null,
          role: d.role,
          shareholding_pct: d.shareholding_pct ? Number(d.shareholding_pct) : null,
          email: d.email || null,
          phone: d.phone || null,
          residential_address: d.residential_address as any,
        }))
      );
      if (dirError) {
        toast.error("Borrower created, but failed to save directors: " + dirError.message);
      }
    }

    toast.success("Borrower added successfully");
    setDialogOpen(false);
    setCompanyData({ ...emptyCompanyForm });
    setDirectors([]);
    fetchBorrowers();
    setSubmitting(false);
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => {
              // Generate invite link for a new borrower
              toast.info("Use 'Add Borrower' to create a borrower record, then send them an invitation from their detail page.");
            }}>
              <Send className="mr-2 h-4 w-4" /> Invite Borrower
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Borrower
            </Button>
          </div>
        </div>

        {!profile?.organization_id && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="text-sm font-medium">No Organization Assigned</p>
            <p className="text-xs">Your account is not currently associated with an organization. Please contact your administrator to be assigned to an organization.</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search borrowers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                <p className="text-sm text-muted-foreground">{search ? "No borrowers match your search" : "No borrowers yet"}</p>
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
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/originator/borrowers/${b.id}`)}>
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
                      <TableCell className="text-sm">
                        {b.country ? (COUNTRIES.find((c) => c.code === b.country)?.name || b.country) : "—"}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{b.industry?.replace(/_/g, " ") || "—"}</TableCell>
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
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/originator/borrowers/${b.id}`); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Borrower Dialog - now uses the rich company form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle>Add New Borrower</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Auto-fill from Registry</p>
                <p className="text-xs text-muted-foreground">Enter a company name or registration number &amp; country above, then click lookup to pre-fill company details.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRegistryLookup} disabled={lookingUp || (!companyData.registration_number && !companyData.company_name)}>
                {lookingUp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
                Lookup
              </Button>
            </div>
            <div className="space-y-6">
              <CompanyInfoStep data={companyData} onChange={setCompanyData} />
              <DirectorsStep 
                directors={directors} 
                onChange={setDirectors} 
                companyName={companyData.company_name}
                registrationNumber={companyData.registration_number}
                countryCode={companyData.country}
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 shrink-0 bg-background border-t">
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
