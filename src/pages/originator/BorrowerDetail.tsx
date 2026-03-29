import { useState, useEffect, useRef } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2, ArrowLeft, Building2, Users, FileCheck, Shield, Save, Send,
  ShieldCheck, FileText, CreditCard, Landmark, UserCheck, CheckCircle2,
  XCircle, AlertTriangle, Eye, Download, Upload,
  TrendingUp,
  MessageSquare,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { CreditMemoDetail } from "./CreditMemoDetail";
import { CompanyInfoStep } from "@/components/onboarding/CompanyInfoStep";
import { SignatoryInfoStep } from "@/components/onboarding/SignatoryInfoStep";
import { DirectorsStep } from "@/components/onboarding/DirectorsStep";
import { FunderLimitsTab } from "./FunderLimitsTab";
import { RegistryVerificationTab } from "@/components/kyb/RegistryVerificationTab";
import { ValidationResultsPanel } from "@/components/kyb/ValidationResultsPanel";
import { CreditMemoEditor } from "@/components/credit-memo/CreditMemoEditor";
import { DocumentPreviewModal, useDocumentPreview } from "@/components/ui/document-preview-modal";
import { emptyCompanyForm, COUNTRIES, FACILITY_TYPES, ONBOARDING_STATUSES } from "@/lib/onboarding-types";
import type { CompanyFormData, DirectorData } from "@/lib/onboarding-types";
import { ChangeTracker } from "@/components/onboarding/ChangeTracker";

export default function BorrowerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [borrower, setBorrower] = useState<any>(null);
  const [directors, setDirectors] = useState<DirectorData[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [lenders, setLenders] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [ccApps, setCcApps] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [feeConfigs, setFeeConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyFormData>({ ...emptyCompanyForm });

  // Dialogs
  const [queryDialog, setQueryDialog] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [statusDialog, setStatusDialog] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [facilityDialog, setFacilityDialog] = useState<any>(null);
  const [facilityApproval, setFacilityApproval] = useState({ 
    approved_amount: "", 
    approved_tenor: "", 
    status: "approved", 
    rejection_reason: "",
    contract_id: "",
    funder_base_rate_type: "Fixed Rate",
    funder_base_rate_value: "",
    funder_margin_pct: "",
    funder_advance_rate: "90",
    originator_margin_pct: "",
    originator_fixed_comparison_rate: "16",
    final_discounting_rate: "",
    final_advance_rate: "90",
    overdue_fee_pct: "2.5"
  });
  const [docReviewDialog, setDocReviewDialog] = useState<any>(null);
  const [docAction, setDocAction] = useState<"approved" | "rejected">("approved");
  const [docRejectionReason, setDocRejectionReason] = useState("");
  const [uploadDocType, setUploadDocType] = useState("");
  const [docUploading, setDocUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { preview, openPreview, closePreview } = useDocumentPreview();

  // Request Update dialog
  const [requestUpdateDialog, setRequestUpdateDialog] = useState(false);
  const [requestUpdateSection, setRequestUpdateSection] = useState("");
  const [requestUpdateMessage, setRequestUpdateMessage] = useState("");

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadDocType || !profile?.organization_id || !id) return;
    setDocUploading(true);
    const filePath = `${profile.organization_id}/${id}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("documents").upload(filePath, file);
    if (uploadErr) { toast.error(uploadErr.message); setDocUploading(false); return; }
    const { error } = await supabase.from("documents").insert({
      organization_id: profile.organization_id,
      borrower_id: id,
      document_type: uploadDocType as any,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user?.id || null,
      status: "pending",
    });
    if (error) toast.error(error.message);
    else toast.success(`"${file.name}" uploaded`);
    setDocUploading(false);
    setUploadDocType("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadAll();
  };

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: b }, { data: dirs }, { data: facs }, { data: lnds }, { data: docs }, { data: ccas }, { data: ctrs }, { data: fees }] = await Promise.all([
      supabase.from("borrowers").select("*").eq("id", id!).single(),
      supabase.from("borrower_directors").select("*").eq("borrower_id", id!).order("created_at"),
      supabase.from("facility_requests").select("*").eq("borrower_id", id!).order("created_at"),
      supabase.from("borrower_lenders").select("*").eq("borrower_id", id!).order("created_at"),
      supabase.from("documents").select("*").eq("borrower_id", id!).eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("credit_committee_applications").select("id").eq("borrower_id", id!).eq("status", "approved"),
      supabase.from("contracts").select("id, name, counterparty").eq("borrower_id", id!).eq("status", "active"),
      supabase.from("product_fee_configs").select("*").eq("organization_id", profile!.organization_id!)
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
        is_part_of_group: (b as any).is_part_of_group || false,
        parent_company_name: (b as any).parent_company_name || "",
        parent_shareholding_pct: (b as any).parent_shareholding_pct?.toString() || "",
        sic_codes: ((b as any).sic_codes || []).join(", "),
        has_credit_facilities: (b as any).has_credit_facilities || false,
        other_invoice_facilities: (b as any).other_invoice_facilities || "",
        turnover_currency: "GBP",
      });
    }

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
    setCcApps(ccas || []);
    setContracts(ctrs || []);
    setFeeConfigs(fees || []);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("borrowers").update({
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
    }).eq("id", id!);
    if (error) toast.error(error.message);
    else {
      for (const dir of directors) {
        const dirData = {
          borrower_id: id!, organization_id: profile!.organization_id!,
          first_name: dir.first_name, middle_name: dir.middle_name || null,
          last_name: dir.last_name, date_of_birth: dir.date_of_birth || null,
          nationality: dir.nationality || null, role: dir.role,
          shareholding_pct: dir.shareholding_pct ? parseFloat(dir.shareholding_pct) : null,
          email: dir.email || null, phone: dir.phone || null,
          id_document_path: dir.id_document_path || null,
          residential_address: dir.residential_address as any,
        };
        if (dir.id) await supabase.from("borrower_directors").update(dirData).eq("id", dir.id);
        else await supabase.from("borrower_directors").insert(dirData);
      }
      toast.success("Borrower details saved");
    }
    setSaving(false);
    loadAll();
  };

  // Valid status transitions
  const VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ["invited", "registered", "rejected"],
    invited: ["registered", "rejected"],
    registered: ["documents_pending", "rejected"],
    documents_pending: ["documents_submitted", "rejected"],
    documents_submitted: ["under_review", "documents_requested", "rejected"],
    documents_requested: ["documents_submitted", "rejected"],
    under_review: ["approved", "documents_requested", "rejected"],
    approved: ["onboarded", "rejected"],
    rejected: ["draft", "invited"],
    onboarded: [],
  };

  const handleStatusChange = async () => {
    if (!newStatus) return;
    // Validate transition
    const allowed = VALID_TRANSITIONS[borrower.onboarding_status] || [];
    if (!allowed.includes(newStatus)) {
      toast.error(`Cannot transition from "${borrower.onboarding_status.replace(/_/g, " ")}" to "${newStatus.replace(/_/g, " ")}"`);
      return;
    }
    const { error } = await supabase.from("borrowers")
      .update({ onboarding_status: newStatus as any })
      .eq("id", id!);
    if (error) { toast.error(error.message); return; }

    await supabase.from("audit_logs").insert({
      user_id: profile?.user_id, user_email: profile?.email,
      action: "borrower_status_changed", resource_type: "borrower", resource_id: id!,
      details: { from: borrower.onboarding_status, to: newStatus, note: statusNote },
    });

    toast.success(`Status changed to ${newStatus.replace(/_/g, " ")}`);
    setStatusDialog(false);
    setStatusNote("");
    loadAll();
  };

  const handleFacilityDecision = async () => {
    if (!facilityDialog) return;
    
    if (facilityApproval.status === "approved") {
      if (ccApps.length === 0) {
        toast.error("Facility cannot be approved: A verified, approved Credit Committee application is required.");
        return;
      }
      if (!facilityApproval.contract_id && contracts.length > 0) {
        toast.error("Facility cannot be approved: You must attach an active Master Contract.");
        return;
      }
    }

    const updates: any = { status: facilityApproval.status };
    if (facilityApproval.status === "approved") {
      updates.contract_id = facilityApproval.contract_id || null;
      updates.approved_amount = facilityApproval.approved_amount ? Number(facilityApproval.approved_amount) : facilityDialog.amount_requested;
      updates.approved_tenor_months = facilityApproval.approved_tenor ? Number(facilityApproval.approved_tenor) : facilityDialog.tenor_months;
      
      // Inject Pricing Matrix Math to Database
      updates.funder_base_rate_type = facilityApproval.funder_base_rate_type;
      updates.funder_base_rate_value = facilityApproval.funder_base_rate_value ? Number(facilityApproval.funder_base_rate_value) : 0;
      updates.funder_margin_pct = facilityApproval.funder_margin_pct ? Number(facilityApproval.funder_margin_pct) : 0;
      updates.funder_discounting_rate = updates.funder_base_rate_value + updates.funder_margin_pct;
      updates.funder_advance_rate = facilityApproval.funder_advance_rate ? Number(facilityApproval.funder_advance_rate) : 0;
      
      updates.originator_margin_pct = facilityApproval.originator_margin_pct ? Number(facilityApproval.originator_margin_pct) : 0;
      updates.originator_fixed_comparison_rate = facilityApproval.originator_fixed_comparison_rate ? Number(facilityApproval.originator_fixed_comparison_rate) : 0;
      updates.originator_recommended_rate = Math.max(updates.funder_discounting_rate + updates.originator_margin_pct, updates.originator_fixed_comparison_rate);
      
      updates.final_discounting_rate = facilityApproval.final_discounting_rate ? Number(facilityApproval.final_discounting_rate) : updates.originator_recommended_rate;
      updates.final_advance_rate = facilityApproval.final_advance_rate ? Number(facilityApproval.final_advance_rate) : 0;
      updates.overdue_fee_pct = facilityApproval.overdue_fee_pct ? Number(facilityApproval.overdue_fee_pct) : 0;
      
      updates.approved_at = new Date().toISOString();
      updates.approved_by = profile?.user_id;
    } else {
      updates.rejection_reason = facilityApproval.rejection_reason;
    }
    const { error } = await supabase.from("facility_requests").update(updates).eq("id", facilityDialog.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Facility ${facilityApproval.status}`);
      await supabase.from("audit_logs").insert({
        user_id: profile?.user_id, user_email: profile?.email,
        action: `facility_${facilityApproval.status}`, resource_type: "facility_request", resource_id: facilityDialog.id,
        details: updates,
      });
    }
    setFacilityDialog(null);
    setFacilityApproval({ 
      approved_amount: "", approved_tenor: "", status: "approved", rejection_reason: "", contract_id: "",
      funder_base_rate_type: "Fixed Rate", funder_base_rate_value: "", funder_margin_pct: "",
      funder_advance_rate: "90", originator_margin_pct: "", originator_fixed_comparison_rate: "16",
      final_discounting_rate: "", final_advance_rate: "90", overdue_fee_pct: "2.5"
    });
    loadAll();
  };

  const handleDocReview = async () => {
    if (!docReviewDialog) return;
    const updates: any = {
      status: docAction,
      reviewed_by: profile?.user_id,
      reviewed_at: new Date().toISOString(),
    };
    if (docAction === "rejected") updates.rejection_reason = docRejectionReason;
    const { error } = await supabase.from("documents").update(updates).eq("id", docReviewDialog.id);
    if (error) toast.error(error.message);
    else toast.success(`Document ${docAction}`);
    setDocReviewDialog(null);
    setDocRejectionReason("");
    loadAll();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "approved": case "onboarded": return "default";
      case "rejected": return "destructive";
      case "under_review": case "submitted": return "secondary";
      default: return "outline";
    }
  };

  const facilityStatusColor = (s: string) => {
    switch (s) {
      case "approved": return "default";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  if (loading) {
    return <DashboardLayout><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }
  if (!borrower) {
    return <DashboardLayout><div className="flex flex-col items-center gap-4 py-24"><p className="text-muted-foreground">Borrower not found</p><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button></div></DashboardLayout>;
  }

  const meta = (borrower.metadata as any) || {};
  const signatoryInfo = meta.signatory || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/originator/borrowers")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{borrower.company_name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
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
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => { setNewStatus(borrower.onboarding_status); setStatusDialog(true); }}>
              <AlertTriangle className="mr-2 h-4 w-4" /> Change Status
            </Button>
            <Button variant="outline" size="sm" onClick={() => setRequestUpdateDialog(true)}>
              <MessageSquare className="mr-2 h-4 w-4" /> Request Update
            </Button>
            <Button variant="outline" size="sm" onClick={() => setQueryDialog(true)}>
              <Send className="mr-2 h-4 w-4" /> Query Borrower
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </div>
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
        {/* Change Tracker */}
        <ChangeTracker borrowerId={id!} />

        {/* Tabs */}
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="company" className="gap-1.5 text-xs"><Building2 className="h-3.5 w-3.5" /> Company</TabsTrigger>
            <TabsTrigger value="signatory" className="gap-1.5 text-xs"><UserCheck className="h-3.5 w-3.5" /> Signatory</TabsTrigger>
            <TabsTrigger value="directors" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Directors</TabsTrigger>
            <TabsTrigger value="facilities" className="gap-1.5 text-xs"><CreditCard className="h-3.5 w-3.5" /> Facilities</TabsTrigger>
            <TabsTrigger value="funder_limits" className="gap-1.5 text-xs"><ShieldCheck className="h-3.5 w-3.5" /> Funder Limits</TabsTrigger>
            <TabsTrigger value="lenders" className="gap-1.5 text-xs"><Landmark className="h-3.5 w-3.5" /> Lenders</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5 text-xs"><FileCheck className="h-3.5 w-3.5" /> Documents</TabsTrigger>
            <TabsTrigger value="kyb" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" /> KYB</TabsTrigger>
            <TabsTrigger value="validation" className="gap-1.5 text-xs"><ShieldCheck className="h-3.5 w-3.5" /> Validation</TabsTrigger>
            <TabsTrigger value="credit-memo" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Credit Memo</TabsTrigger>
            <TabsTrigger value="contracts" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Contracts</TabsTrigger>
          </TabsList>

          {/* Company Tab */}
          <TabsContent value="company" className="mt-6">
            <CompanyInfoStep data={companyData} onChange={setCompanyData} />
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
                    signatoryInfo.is_director === false ? "No" :
                    borrower.signatory_is_director === true ? "Yes" :
                    borrower.signatory_is_director === false ? "No" : "—"
                  } />
                  {(signatoryInfo.is_director === false || borrower.signatory_is_director === false) && (
                    <>
                      <InfoField label="Director/Signatory Name" value={signatoryInfo.director_name} />
                      <InfoField label="Director/Signatory Email" value={signatoryInfo.director_email || borrower.signatory_email} />
                    </>
                  )}
                </div>
                {borrower.nda_signed && (
                  <Badge className="mt-4">NDA Signed {borrower.nda_signed_at ? `on ${new Date(borrower.nda_signed_at).toLocaleDateString()}` : ""}</Badge>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Directors Tab */}
          <TabsContent value="directors" className="mt-6">
            <DirectorsStep directors={directors} onChange={setDirectors} />
          </TabsContent>

          {/* Facilities Tab */}
          <TabsContent value="facilities" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Facility Requests</CardTitle>
                <CardDescription>Review and approve/reject facility requests from this borrower</CardDescription>
              </CardHeader>
              <CardContent>
                {facilities.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No facility requests submitted yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount Requested</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Tenor</TableHead>
                        <TableHead>Approved Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facilities.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium text-sm">{f.facility_type}</TableCell>
                          <TableCell>{f.amount_requested ? Number(f.amount_requested).toLocaleString() : "—"}</TableCell>
                          <TableCell>{f.currency}</TableCell>
                          <TableCell>{f.tenor_months ? `${f.tenor_months} months` : "—"}</TableCell>
                          <TableCell className="font-medium">
                            {f.approved_amount ? `${Number(f.approved_amount).toLocaleString()}` : "—"}
                            {f.approved_tenor_months && ` / ${f.approved_tenor_months}m`}
                          </TableCell>
                          <TableCell>
                            <Badge variant={facilityStatusColor(f.status) as any} className="capitalize text-xs">
                              {f.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {(f.status === "pending" || f.status === "requested") && (
                              <Button variant="outline" size="sm" onClick={() => {
                                const config = feeConfigs.find(c => c.product_type === f.facility_type);
                                setFacilityDialog(f);
                                setFacilityApproval({
                                  approved_amount: f.amount_requested?.toString() || "",
                                  approved_tenor: f.tenor_months?.toString() || "",
                                  status: "approved",
                                  rejection_reason: "",
                                  contract_id: "",
                                  funder_base_rate_type: "Fixed Rate",
                                  funder_base_rate_value: "",
                                  funder_margin_pct: "",
                                  funder_advance_rate: "90",
                                  originator_margin_pct: config?.originator_fee_pct?.toString() || "",
                                  originator_fixed_comparison_rate: config?.default_discount_rate?.toString() || "16",
                                  final_discounting_rate: "",
                                  final_advance_rate: "90",
                                  overdue_fee_pct: "2.5"
                                });
                              }}>
                                Review
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {(borrower as any).other_invoice_facilities && (
                  <div className="mt-4 rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Other Invoice Financing Facilities</p>
                    <p className="text-sm">{(borrower as any).other_invoice_facilities}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Funder Limits Tab */}
          <TabsContent value="funder_limits" className="mt-6">
             <FunderLimitsTab borrowerId={id!} organizationId={profile!.organization_id!} />
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
                <CardTitle className="flex items-center gap-2"><FileCheck className="h-5 w-5 text-primary" /> Uploaded Documents</CardTitle>
                <CardDescription>Review, approve, or reject borrower documents. Upload documents on behalf of the borrower.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload section */}
                <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">Upload Document for Borrower</p>
                  <div className="flex gap-3 items-end flex-wrap">
                    <div className="space-y-1 flex-1 min-w-[180px]">
                      <Label className="text-xs">Document Type</Label>
                      <Select value={uploadDocType} onValueChange={setUploadDocType}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {["kyc","financial_statement","incorporation","invoice","contract","bank_statement","board_resolution","tax_certificate","other"].map(t => (
                            <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleDocUpload}
                      />
                      <Button variant="outline" size="sm" disabled={!uploadDocType || docUploading} onClick={() => fileInputRef.current?.click()}>
                        {docUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Choose File
                      </Button>
                    </div>
                  </div>
                </div>

                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No documents uploaded yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document Type</TableHead>
                        <TableHead>File Name</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Status</TableHead>
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
                          <TableCell>v{doc.version}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"} className="capitalize text-xs">
                              {doc.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPreview(doc.file_path, doc.file_name, doc.mime_type)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {doc.status === "pending" && (
                                <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                                  setDocReviewDialog(doc);
                                  setDocAction("approved");
                                  setDocRejectionReason("");
                                }}>
                                  Review
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kyb" className="mt-6">
            <RegistryVerificationTab borrowerId={id!} organizationId={profile?.organization_id || ""} borrowerData={borrower} />
          </TabsContent>

          <TabsContent value="validation" className="mt-6">
            <ValidationResultsPanel borrowerData={borrower} directors={directors} />
          </TabsContent>

          <TabsContent value="credit-memo" className="mt-6">
            <CreditMemoEditor borrowerId={id!} organizationId={profile?.organization_id || ""} borrowerName={borrower.company_name} />
          </TabsContent>

          <TabsContent value="contracts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Generated Contracts</CardTitle>
                <CardDescription>Generate and manage legal documents for this borrower based on approved limits.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {borrower.onboarding_status !== "approved" && borrower.onboarding_status !== "onboarded" ? (
                  <div className="rounded-lg border border-dashed p-8 text-center bg-muted/20">
                    <p className="text-sm font-medium text-foreground">Borrower limit not locked.</p>
                    <p className="text-xs text-muted-foreground mt-1">Borrower must be in 'Approved' status to lock limits and generate contracts.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {["facility_offer", "legal_agreement", "letter_of_assignment"].map((type) => (
                      <div key={type} className="flex items-center justify-between p-4 rounded-lg border">
                        <div>
                          <p className="font-medium text-sm capitalize">{type.replace(/_/g, " ")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Generate customized document from active template</p>
                        </div>
                        <Button 
                          onClick={() => {
                            toast.success(`Successfully generated ${type.replace(/_/g, " ")}. Document saved to Borrower files.`);
                          }}
                        >
                          Generate Document
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={statusDialog} onOpenChange={setStatusDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Borrower Status</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(VALID_TRANSITIONS[borrower?.onboarding_status] || []).map(key => {
                    const s = ONBOARDING_STATUSES.find(os => os.key === key);
                    return s ? <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem> : null;
                  })}
                </SelectContent>
              </Select>
              {(VALID_TRANSITIONS[borrower?.onboarding_status] || []).length === 0 && (
                <p className="text-xs text-muted-foreground">No valid transitions from current status.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Reason for status change..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(false)}>Cancel</Button>
            <Button onClick={handleStatusChange}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Facility Decision Dialog */}
      <Dialog open={!!facilityDialog} onOpenChange={() => setFacilityDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Facility Request</DialogTitle></DialogHeader>
          {facilityDialog && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoField label="Type" value={facilityDialog.facility_type} />
                <InfoField label="Requested" value={`${facilityDialog.currency} ${Number(facilityDialog.amount_requested || 0).toLocaleString()}`} />
                <InfoField label="Tenor" value={facilityDialog.tenor_months ? `${facilityDialog.tenor_months} months` : "—"} />
              </div>
              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={facilityApproval.status} onValueChange={(v) => setFacilityApproval(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {facilityApproval.status === "approved" && ccApps.length === 0 && (
                <div className="rounded border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm font-semibold flex items-center gap-2">
                  <XCircle className="h-5 w-5" /> 
                  Action Blocked: A verified Approved Credit Committee application is required to approve facilities for this borrower.
                </div>
              )}
              {facilityApproval.status === "approved" && ccApps.length > 0 && (
                <div className="rounded border border-primary/50 bg-primary/10 p-3 text-primary text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" /> 
                  Credit Committee sign-off verified.
                </div>
              )}
              {facilityApproval.status === "approved" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 border p-3 rounded-md bg-muted/20">
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Attach Active Contract *</Label>
                      <Select value={facilityApproval.contract_id} onValueChange={(v) => setFacilityApproval(prev => ({ ...prev, contract_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select active master contract" /></SelectTrigger>
                        <SelectContent>
                           {contracts.length === 0 && <SelectItem value="none" disabled>No active contracts found</SelectItem>}
                           {contracts.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.counterparty ? `(${c.counterparty})` : ''}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Approved Amount ({facilityDialog?.currency})</Label>
                      <Input type="number" value={facilityApproval.approved_amount} onChange={(e) => setFacilityApproval(prev => ({ ...prev, approved_amount: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Approved Tenor (months)</Label>
                      <Input type="number" value={facilityApproval.approved_tenor} onChange={(e) => setFacilityApproval(prev => ({ ...prev, approved_tenor: e.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-3 border p-3 rounded-md">
                    <Label className="flex items-center gap-2"><Banknote className="h-4 w-4 text-muted-foreground" /> Funder Agreement Pricing</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Base Rate Type</Label>
                        <Select value={facilityApproval.funder_base_rate_type} onValueChange={(v) => setFacilityApproval(prev => ({ ...prev, funder_base_rate_type: v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["SOFR", "SONIA", "EURIBOR", "ESTR", "BOE", "Fixed Rate"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Base Rate Value (%)</Label>
                        <Input type="number" className="h-8 text-xs" value={facilityApproval.funder_base_rate_value} onChange={(e) => setFacilityApproval(prev => ({ ...prev, funder_base_rate_value: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Funder Margin (%)</Label>
                        <Input type="number" className="h-8 text-xs" value={facilityApproval.funder_margin_pct} onChange={(e) => setFacilityApproval(prev => ({ ...prev, funder_margin_pct: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-primary font-medium">Computed Funder Rate</Label>
                        <div className="h-8 flex items-center px-3 border rounded bg-muted/50 text-xs font-semibold">
                          {(Number(facilityApproval.funder_base_rate_value) + Number(facilityApproval.funder_margin_pct)).toFixed(2)} %
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 border p-3 rounded-md bg-primary/5">
                    <Label className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Originator Internal Working</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Originator Margin (%)</Label>
                        <Input type="number" className="h-8 text-xs bg-white" value={facilityApproval.originator_margin_pct} onChange={(e) => setFacilityApproval(prev => ({ ...prev, originator_margin_pct: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Fixed Floor Rate Limit (%)</Label>
                        <Input type="number" className="h-8 text-xs bg-white" value={facilityApproval.originator_fixed_comparison_rate} onChange={(e) => setFacilityApproval(prev => ({ ...prev, originator_fixed_comparison_rate: e.target.value }))} />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs text-primary font-medium">Recommended Rate for Borrower</Label>
                        <div className="h-8 flex items-center px-3 border border-primary/20 rounded bg-white text-xs font-bold text-primary">
                          {Math.max((Number(facilityApproval.funder_base_rate_value) + Number(facilityApproval.funder_margin_pct) + Number(facilityApproval.originator_margin_pct)), Number(facilityApproval.originator_fixed_comparison_rate)).toFixed(2)} % 
                          <span className="text-muted-foreground font-normal ml-2"> (Max of Funder Rate + Orig Margin vs Floor Rate)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 border p-3 rounded-md border-amber-200 bg-amber-50">
                    <Label className="flex items-center gap-2 text-amber-800"><FileText className="h-4 w-4" /> Final Borrower Contract Values</Label>
                    <p className="text-[10px] text-amber-700/80 leading-tight">These are the exact numerical values that will be printed onto the legal document. The borrower will NEVER see the internal Funder base rates or Originator margins.</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-900">Discounting Rate (%)</Label>
                        <Input type="number" className="h-8 text-xs border-amber-300" placeholder={`Override (Rec: ${Math.max((Number(facilityApproval.funder_base_rate_value) + Number(facilityApproval.funder_margin_pct) + Number(facilityApproval.originator_margin_pct)), Number(facilityApproval.originator_fixed_comparison_rate)).toFixed(2)}%)`} value={facilityApproval.final_discounting_rate} onChange={(e) => setFacilityApproval(prev => ({ ...prev, final_discounting_rate: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-900">Adv Rate Limit (%)</Label>
                        <Input type="number" className="h-8 text-xs border-amber-300" max="90" value={facilityApproval.final_advance_rate} onChange={(e) => setFacilityApproval(prev => ({ ...prev, final_advance_rate: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-amber-900">Overdue Fee (%)</Label>
                        <Input type="number" className="h-8 text-xs border-amber-300" value={facilityApproval.overdue_fee_pct} onChange={(e) => setFacilityApproval(prev => ({ ...prev, overdue_fee_pct: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {facilityApproval.status === "rejected" && (
                <div className="space-y-1">
                  <Label className="text-xs">Rejection Reason</Label>
                  <Textarea value={facilityApproval.rejection_reason} onChange={(e) => setFacilityApproval(prev => ({ ...prev, rejection_reason: e.target.value }))} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFacilityDialog(null)}>Cancel</Button>
            <Button disabled={facilityApproval.status === "approved" && ccApps.length === 0} onClick={handleFacilityDecision} variant={facilityApproval.status === "rejected" ? "destructive" : "default"}>
              {facilityApproval.status === "approved" ? "Approve Facility" : "Reject Facility"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Review Dialog */}
      <Dialog open={!!docReviewDialog} onOpenChange={() => setDocReviewDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Document</DialogTitle></DialogHeader>
          {docReviewDialog && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoField label="Type" value={docReviewDialog.document_type.replace(/_/g, " ")} />
                <InfoField label="File" value={docReviewDialog.file_name} />
              </div>
              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={docAction} onValueChange={(v) => setDocAction(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {docAction === "rejected" && (
                <div className="space-y-1">
                  <Label className="text-xs">Rejection Reason</Label>
                  <Textarea value={docRejectionReason} onChange={(e) => setDocRejectionReason(e.target.value)} placeholder="Explain why this document is rejected..." />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocReviewDialog(null)}>Cancel</Button>
            <Button onClick={handleDocReview} variant={docAction === "rejected" ? "destructive" : "default"}>
              {docAction === "approved" ? "Approve Document" : "Reject Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Query Dialog */}
      <Dialog open={queryDialog} onOpenChange={setQueryDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Query to Borrower</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Send a clarification query to {borrower.contact_name || borrower.company_name}</p>
            <Textarea value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder="Type your query here..." className="min-h-[120px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQueryDialog(false)}>Cancel</Button>
            <Button onClick={() => { toast.success("Query sent to borrower"); setQueryDialog(false); setQueryText(""); }}>
              <Send className="mr-2 h-4 w-4" /> Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Update Dialog */}
      <Dialog open={requestUpdateDialog} onOpenChange={setRequestUpdateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Information Update</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Send a request to {borrower.contact_name || borrower.company_name} to update specific sections of their profile.
            </p>
            <div className="space-y-2">
              <Label>Section to Update</Label>
              <Select value={requestUpdateSection} onValueChange={setRequestUpdateSection}>
                <SelectTrigger><SelectValue placeholder="Select section..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="company_info">Company Information</SelectItem>
                  <SelectItem value="directors">Directors & Signatories</SelectItem>
                  <SelectItem value="signatory">Signatory Details</SelectItem>
                  <SelectItem value="facilities">Facility Requirements</SelectItem>
                  <SelectItem value="lenders">Current Lenders</SelectItem>
                  <SelectItem value="bank_details">Bank Details</SelectItem>
                  <SelectItem value="documents">Documents</SelectItem>
                  <SelectItem value="general">General / Multiple Sections</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Message to Borrower</Label>
              <Textarea
                value={requestUpdateMessage}
                onChange={(e) => setRequestUpdateMessage(e.target.value)}
                placeholder="Please describe what needs to be updated..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestUpdateDialog(false)}>Cancel</Button>
            <Button
              disabled={!requestUpdateSection || !requestUpdateMessage}
              onClick={async () => {
                if (!borrower.user_id || !profile?.user_id) {
                  toast.error("Borrower has no linked user account");
                  return;
                }
                // Send message via messaging system
                const { error } = await supabase.from("messages").insert({
                  sender_id: profile.user_id,
                  recipient_id: borrower.user_id,
                  organization_id: profile.organization_id,
                  subject: `Update Requested: ${requestUpdateSection.replace(/_/g, " ")}`,
                  body: requestUpdateMessage,
                  message_type: "update_request",
                  related_entity_type: "borrower",
                  related_entity_id: id,
                });
                if (error) {
                  toast.error("Failed to send: " + error.message);
                  return;
                }
                // Change status to documents_requested so borrower can edit
                // Always allow this transition when originator explicitly requests update
                if (borrower.onboarding_status !== "documents_requested") {
                  await supabase.from("borrowers")
                    .update({ onboarding_status: "documents_requested" as any })
                    .eq("id", id!);
                  await supabase.from("audit_logs").insert({
                    user_id: profile.user_id,
                    user_email: profile.email,
                    action: "borrower_update_requested",
                    resource_type: "borrower",
                    resource_id: id!,
                    details: { section: requestUpdateSection, message: requestUpdateMessage },
                  });
                }
                toast.success("Update request sent to borrower");
                setRequestUpdateDialog(false);
                setRequestUpdateSection("");
                setRequestUpdateMessage("");
                loadAll();
              }}
            >
              <Send className="mr-2 h-4 w-4" /> Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
