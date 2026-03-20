import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, Building2, Users, FileCheck, Shield, Plus, Save, Send, ShieldCheck, FileText } from "lucide-react";
import { toast } from "sonner";
import { CompanyInfoStep } from "@/components/onboarding/CompanyInfoStep";
import { DirectorsStep } from "@/components/onboarding/DirectorsStep";
import { RegistryVerificationTab } from "@/components/kyb/RegistryVerificationTab";
import { ValidationResultsPanel } from "@/components/kyb/ValidationResultsPanel";
import { CreditMemoEditor } from "@/components/credit-memo/CreditMemoEditor";
import { emptyCompanyForm, emptyDirector, COUNTRIES } from "@/lib/onboarding-types";
import type { CompanyFormData, DirectorData } from "@/lib/onboarding-types";

export default function BorrowerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [borrower, setBorrower] = useState<any>(null);
  const [directors, setDirectors] = useState<DirectorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyFormData>({ ...emptyCompanyForm });
  const [queryDialog, setQueryDialog] = useState(false);
  const [queryText, setQueryText] = useState("");

  useEffect(() => {
    if (id) loadBorrower();
  }, [id]);

  const loadBorrower = async () => {
    setLoading(true);
    const [{ data: b }, { data: dirs }] = await Promise.all([
      supabase.from("borrowers").select("*").eq("id", id!).single(),
      supabase.from("borrower_directors").select("*").eq("borrower_id", id!).order("created_at"),
    ]);

    if (b) {
      setBorrower(b);
      setCompanyData({
        company_name: b.company_name || "",
        trading_name: b.trading_name || "",
        registration_number: b.registration_number || "",
        country: b.country || "",
        incorporation_date: b.incorporation_date || "",
        industry: b.industry || "",
        registered_address: (b.registered_address as any) || { ...emptyCompanyForm.registered_address },
        trading_address: (b.trading_address as any) || { ...emptyCompanyForm.trading_address },
        phone: b.phone || b.contact_phone || "",
        website: b.website || "",
        contact_email: b.contact_email || "",
        contact_name: b.contact_name || "",
        vat_tax_id: b.vat_tax_id || "",
        num_employees: b.num_employees?.toString() || "",
        annual_turnover: b.annual_turnover?.toString() || "",
      });
    }

    if (dirs) {
      setDirectors(
        dirs.map((d: any) => ({
          id: d.id,
          first_name: d.first_name,
          middle_name: d.middle_name || "",
          last_name: d.last_name,
          date_of_birth: d.date_of_birth || "",
          nationality: d.nationality || "",
          role: d.role || "director",
          shareholding_pct: d.shareholding_pct?.toString() || "",
          email: d.email || "",
          phone: d.phone || "",
          id_document_path: d.id_document_path || "",
          residential_address: (d.residential_address as any) || { line1: "", line2: "", city: "", state: "", postal_code: "", country: "" },
        }))
      );
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // Update borrower
    const { error: bError } = await supabase
      .from("borrowers")
      .update({
        company_name: companyData.company_name,
        trading_name: companyData.trading_name || null,
        registration_number: companyData.registration_number || null,
        country: companyData.country || null,
        incorporation_date: companyData.incorporation_date || null,
        industry: companyData.industry || null,
        registered_address: companyData.registered_address as any,
        trading_address: companyData.trading_address as any,
        phone: companyData.phone || null,
        website: companyData.website || null,
        contact_email: companyData.contact_email,
        contact_name: companyData.contact_name || null,
        vat_tax_id: companyData.vat_tax_id || null,
        num_employees: companyData.num_employees ? parseInt(companyData.num_employees) : null,
        annual_turnover: companyData.annual_turnover ? parseFloat(companyData.annual_turnover) : null,
      })
      .eq("id", id!);

    if (bError) {
      toast.error(bError.message);
      setSaving(false);
      return;
    }

    // Upsert directors
    for (const dir of directors) {
      const dirData = {
        borrower_id: id!,
        organization_id: profile!.organization_id!,
        first_name: dir.first_name,
        middle_name: dir.middle_name || null,
        last_name: dir.last_name,
        date_of_birth: dir.date_of_birth || null,
        nationality: dir.nationality || null,
        role: dir.role,
        shareholding_pct: dir.shareholding_pct ? parseFloat(dir.shareholding_pct) : null,
        email: dir.email || null,
        phone: dir.phone || null,
        id_document_path: dir.id_document_path || null,
        residential_address: dir.residential_address as any,
      };

      if (dir.id) {
        await supabase.from("borrower_directors").update(dirData).eq("id", dir.id);
      } else {
        await supabase.from("borrower_directors").insert(dirData);
      }
    }

    toast.success("Borrower details saved");
    setSaving(false);
    loadBorrower();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": return "default";
      case "rejected": return "destructive";
      case "under_review": return "secondary";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  if (!borrower) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center gap-4 py-24">
          <p className="text-muted-foreground">Borrower not found</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/originator/borrowers")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{borrower.company_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={statusColor(borrower.onboarding_status) as any} className="capitalize text-xs">
                  {borrower.onboarding_status.replace(/_/g, " ")}
                </Badge>
                <Badge variant={borrower.kyc_completed ? "default" : "outline"} className="text-xs">
                  KYC: {borrower.kyc_completed ? "Complete" : "Pending"}
                </Badge>
                {borrower.country && (
                  <span className="text-xs text-muted-foreground">
                    {COUNTRIES.find((c) => c.code === borrower.country)?.name || borrower.country}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setQueryDialog(true)}>
              <Send className="mr-2 h-4 w-4" /> Query Borrower
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="company" className="gap-1.5">
              <Building2 className="h-4 w-4" /> Company
            </TabsTrigger>
            <TabsTrigger value="directors" className="gap-1.5">
              <Users className="h-4 w-4" /> Directors
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileCheck className="h-4 w-4" /> Documents
            </TabsTrigger>
            <TabsTrigger value="kyb" className="gap-1.5">
              <Shield className="h-4 w-4" /> KYB
            </TabsTrigger>
            <TabsTrigger value="validation" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Validation
            </TabsTrigger>
            <TabsTrigger value="credit-memo" className="gap-1.5">
              <FileText className="h-4 w-4" /> Credit Memo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="mt-6">
            <CompanyInfoStep data={companyData} onChange={setCompanyData} />
          </TabsContent>

          <TabsContent value="directors" className="mt-6">
            <DirectorsStep directors={directors} onChange={setDirectors} />
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Uploaded Documents</CardTitle>
                <CardDescription>KYC/KYB documents uploaded during onboarding</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Document management is available in the Documents section.</p>
                <Button variant="outline" className="mt-4" onClick={() => navigate("/originator/documents")}>
                  View Documents
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kyb" className="mt-6">
            <RegistryVerificationTab
              borrowerId={id!}
              organizationId={profile?.organization_id || ""}
              borrowerData={borrower}
            />
          </TabsContent>

          <TabsContent value="validation" className="mt-6">
            <ValidationResultsPanel
              borrowerData={borrower}
              directors={directors}
            />
          </TabsContent>

          <TabsContent value="credit-memo" className="mt-6">
            <CreditMemoEditor
              borrowerId={id!}
              organizationId={profile?.organization_id || ""}
              borrowerName={borrower.company_name}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Query Dialog */}
      <Dialog open={queryDialog} onOpenChange={setQueryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Query to Borrower</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Send a clarification query to {borrower.contact_name || borrower.company_name} at {borrower.contact_email}
            </p>
            <textarea
              className="w-full rounded-md border bg-background p-3 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Type your query here..."
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQueryDialog(false)}>Cancel</Button>
            <Button onClick={() => { toast.success("Query sent to borrower"); setQueryDialog(false); setQueryText(""); }}>
              <Send className="mr-2 h-4 w-4" /> Send Query
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
