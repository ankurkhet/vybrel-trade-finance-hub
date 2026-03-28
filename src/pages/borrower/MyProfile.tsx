import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, Building2, Users, FileCheck, CreditCard, Landmark, UserCheck,
  CheckCircle2, Eye, Clock, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyInfoStep } from "@/components/onboarding/CompanyInfoStep";
import { DirectorsStep } from "@/components/onboarding/DirectorsStep";
import { DocumentPreviewModal, useDocumentPreview } from "@/components/ui/document-preview-modal";
import { emptyCompanyForm, COUNTRIES, ONBOARDING_STATUSES } from "@/lib/onboarding-types";
import type { CompanyFormData, DirectorData } from "@/lib/onboarding-types";

export default function BorrowerMyProfile() {
  const { user, profile } = useAuth();
  const [borrower, setBorrower] = useState<any>(null);
  const [directors, setDirectors] = useState<DirectorData[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [lenders, setLenders] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyData, setCompanyData] = useState<CompanyFormData>({ ...emptyCompanyForm });
  const { preview, openPreview, closePreview } = useDocumentPreview();

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    const { data: b } = await supabase
      .from("borrowers")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (!b) { setLoading(false); return; }
    setBorrower(b);

    const [{ data: dirs }, { data: facs }, { data: lnds }, { data: docs }] = await Promise.all([
      supabase.from("borrower_directors").select("*").eq("borrower_id", b.id).order("created_at"),
      supabase.from("facility_requests").select("*").eq("borrower_id", b.id).order("created_at"),
      supabase.from("borrower_lenders").select("*").eq("borrower_id", b.id).order("created_at"),
      supabase.from("documents").select("*").eq("borrower_id", b.id).eq("is_deleted", false).order("created_at", { ascending: false }),
    ]);

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
      is_part_of_group: (b as any).is_part_of_group || false,
      parent_company_name: (b as any).parent_company_name || "",
      parent_shareholding_pct: (b as any).parent_shareholding_pct?.toString() || "",
      sic_codes: ((b as any).sic_codes || []).join(", "),
      has_credit_facilities: (b as any).has_credit_facilities || false,
      other_invoice_facilities: (b as any).other_invoice_facilities || "",
      turnover_currency: "GBP",
    });

    if (dirs) {
      setDirectors(dirs.map((d: any) => ({
        id: d.id, first_name: d.first_name, middle_name: d.middle_name || "",
        last_name: d.last_name, date_of_birth: d.date_of_birth || "",
        nationality: d.nationality || "", role: d.role || "director",
        shareholding_pct: d.shareholding_pct?.toString() || "",
        email: d.email || "", phone: d.phone || "",
        id_document_path: d.id_document_path || "",
        residential_address: (d.residential_address as any) || { line1: "", line2: "", city: "", state: "", postal_code: "", country: "" },
      })));
    }
    setFacilities(facs || []);
    setLenders(lnds || []);
    setDocuments(docs || []);
    setLoading(false);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": case "onboarded": return "default";
      case "rejected": return "destructive";
      case "under_review": case "submitted": return "secondary";
      default: return "outline";
    }
  };

  if (loading) {
    return <DashboardLayout><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }
  if (!borrower) {
    return <DashboardLayout><div className="text-center py-24 text-muted-foreground">No profile found. Please complete onboarding first.</div></DashboardLayout>;
  }

  const meta = (borrower.metadata as any) || {};
  const signatoryInfo = meta.signatory || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{borrower.company_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={statusColor(borrower.onboarding_status) as any} className="capitalize text-xs">
                {borrower.onboarding_status.replace(/_/g, " ")}
              </Badge>
              {borrower.country && (
                <span className="text-xs text-muted-foreground">
                  {COUNTRIES.find((c) => c.code === borrower.country)?.name || borrower.country}
                </span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.href = "/borrower/onboarding"}>
            Go to Onboarding
          </Button>
        </div>

        {/* Status Progress */}
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between gap-1 overflow-x-auto">
            {ONBOARDING_STATUSES.filter(s => s.key !== "rejected").map((status, i, arr) => {
              const statusIdx = ONBOARDING_STATUSES.findIndex(s => s.key === borrower.onboarding_status);
              const thisIdx = ONBOARDING_STATUSES.findIndex(s => s.key === status.key);
              const isActive = status.key === borrower.onboarding_status;
              const isPast = thisIdx < statusIdx;
              return (
                <div key={status.key} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
                    isActive ? "bg-primary text-primary-foreground" : isPast ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {isPast && <CheckCircle2 className="h-3 w-3" />}
                    {status.label}
                  </div>
                  {i < arr.length - 1 && <div className={`h-px w-4 ${isPast ? "bg-primary" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="company" className="gap-1.5 text-xs"><Building2 className="h-3.5 w-3.5" /> Company</TabsTrigger>
            <TabsTrigger value="signatory" className="gap-1.5 text-xs"><UserCheck className="h-3.5 w-3.5" /> Signatory</TabsTrigger>
            <TabsTrigger value="directors" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Directors</TabsTrigger>
            <TabsTrigger value="facilities" className="gap-1.5 text-xs"><CreditCard className="h-3.5 w-3.5" /> Facilities</TabsTrigger>
            <TabsTrigger value="lenders" className="gap-1.5 text-xs"><Landmark className="h-3.5 w-3.5" /> Lenders</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 text-xs"><FileCheck className="h-3.5 w-3.5" /> Documents</TabsTrigger>
          </TabsList>

          {/* Company Tab - read-only */}
          <TabsContent value="company" className="mt-6">
            <CompanyInfoStep data={companyData} onChange={() => {}} disabled={true} />
          </TabsContent>

          {/* Signatory Tab */}
          <TabsContent value="signatory" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" /> Signatory Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoField label="Full Name" value={signatoryInfo.full_name || borrower.signatory_name} />
                  <InfoField label="Designation" value={signatoryInfo.designation || borrower.signatory_designation} />
                  <InfoField label="Date of Birth" value={signatoryInfo.dob || borrower.signatory_dob} />
                  <InfoField label="Is Director/Signatory" value={
                    signatoryInfo.is_director === true ? "Yes" :
                    signatoryInfo.is_director === false ? "No" : "—"
                  } />
                </div>
                {borrower.nda_signed && (
                  <Badge className="mt-4">NDA Signed {borrower.nda_signed_at ? `on ${new Date(borrower.nda_signed_at).toLocaleDateString()}` : ""}</Badge>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Directors Tab - read-only */}
          <TabsContent value="directors" className="mt-6">
            <DirectorsStep directors={directors} onChange={() => {}} disabled={true} />
          </TabsContent>

          {/* Facilities Tab */}
          <TabsContent value="facilities" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> My Facility Requests</CardTitle>
                <CardDescription>Facilities you have requested and their approval status</CardDescription>
              </CardHeader>
              <CardContent>
                {facilities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No facility requests yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Approved Amount/Tenor</TableHead>
                        <TableHead>Contracted Rates</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facilities.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium text-sm capitalize">{f.facility_type?.replace(/_/g, " ")}</TableCell>
                          <TableCell>{f.amount_requested ? Number(f.amount_requested).toLocaleString() : "—"}</TableCell>
                          <TableCell>{f.currency}</TableCell>
                          <TableCell className="font-medium">
                            {f.approved_amount ? `${Number(f.approved_amount).toLocaleString()}` : "—"}
                            {f.approved_tenor_months && ` / ${f.approved_tenor_months}m`}
                          </TableCell>
                          <TableCell>
                            {f.status === "approved" ? (
                              <div className="flex flex-col gap-1 text-[11px] leading-tight text-muted-foreground">
                                <div><span className="font-medium text-foreground">Discount Rate:</span> {f.final_discounting_rate || "—"}%</div>
                                <div><span className="font-medium text-foreground">Advance Limit:</span> {f.final_advance_rate || "—"}%</div>
                                <div><span className="font-medium text-foreground">Overdue Fee:</span> {f.overdue_fee_pct || "—"}%</div>
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={f.status === "approved" ? "default" : f.status === "rejected" ? "destructive" : "secondary"} className="capitalize text-xs">
                              {f.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lenders Tab */}
          <TabsContent value="lenders" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-primary" /> Current Lenders / Bankers</CardTitle>
              </CardHeader>
              <CardContent>
                {lenders.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No lenders listed.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lender / Bank</TableHead>
                        <TableHead>Nature</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Secured</TableHead>
                        <TableHead>Repayment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lenders.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.lender_name}</TableCell>
                          <TableCell>{l.facility_nature || "—"}</TableCell>
                          <TableCell>{l.facility_amount ? `${l.currency} ${Number(l.facility_amount).toLocaleString()}` : "—"}</TableCell>
                          <TableCell>{l.is_secured ? "Yes" : "No"}</TableCell>
                          <TableCell>{l.repayment_schedule || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-primary" /> My Documents</CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No documents uploaded yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>File Name</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell className="capitalize text-sm">{doc.document_type.replace(/_/g, " ")}</TableCell>
                          <TableCell>
                            <button
                              className="text-sm text-primary underline hover:text-primary/80 text-left"
                              onClick={() => openPreview(doc.file_path, doc.file_name, doc.mime_type)}
                            >
                              {doc.file_name}
                            </button>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"} className="capitalize text-xs">
                              {doc.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{doc.notes || doc.rejection_reason || "—"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPreview(doc.file_path, doc.file_name, doc.mime_type)}>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Document Preview Modal */}
      {preview && (
        <DocumentPreviewModal
          open={!!preview}
          onOpenChange={(open) => !open && closePreview()}
          filePath={preview.filePath}
          fileName={preview.fileName}
          mimeType={preview.mimeType}
        />
      )}
    </DashboardLayout>
  );
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}
