import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building2,
  User,
  FileCheck,
  Brain,
  Landmark,
  Upload,
  CreditCard,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { CompanyInfoStep } from "@/components/onboarding/CompanyInfoStep";
import { DirectorsStep } from "@/components/onboarding/DirectorsStep";
import { BankDetailsForm, emptyBankDetails } from "@/components/onboarding/BankDetailsForm";
import { SignatoryInfoStep } from "@/components/onboarding/SignatoryInfoStep";
import { FacilityRequirementsStep } from "@/components/onboarding/FacilityRequirementsStep";
import { CurrentLendersStep } from "@/components/onboarding/CurrentLendersStep";
import { DocumentChecklistStep } from "@/components/onboarding/DocumentChecklistStep";
import type { BankDetails } from "@/components/onboarding/BankDetailsForm";
import {
  emptyCompanyForm,
  emptyDirector,
  emptySignatoryForm,
  emptyFacilityRequest,
  emptyLender,
  ONBOARDING_STATUSES,
} from "@/lib/onboarding-types";
import type {
  CompanyFormData,
  DirectorData,
  SignatoryFormData,
  FacilityRequestData,
  LenderData,
} from "@/lib/onboarding-types";

const STEPS = [
  { id: "signatory", label: "Your Details", icon: UserCheck },
  { id: "company", label: "Company Info", icon: Building2 },
  { id: "directors", label: "Directors & Signatories", icon: User },
  { id: "facilities", label: "Facility Requirements", icon: CreditCard },
  { id: "lenders", label: "Current Lenders", icon: Landmark },
  { id: "bank", label: "Bank Details", icon: Landmark },
  { id: "documents", label: "Documents", icon: Upload },
  { id: "review", label: "Review & Submit", icon: Brain },
  { id: "complete", label: "Complete", icon: FileCheck },
];

interface UploadedDoc {
  type: string;
  name: string;
  path: string;
  size: number;
  uploaded_at: string;
}

export default function BorrowerOnboarding() {
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [borrowerId, setBorrowerId] = useState<string | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState("draft");

  // Signatory info
  const [signatoryData, setSignatoryData] = useState<SignatoryFormData>({
    ...emptySignatoryForm,
    full_name: profile?.full_name || "",
  });

  // Company info
  const [companyData, setCompanyData] = useState<CompanyFormData>({
    ...emptyCompanyForm,
    contact_name: profile?.full_name || "",
    contact_email: profile?.email || "",
  });

  // Directors
  const [directors, setDirectors] = useState<DirectorData[]>([]);

  // Facility requests
  const [facilities, setFacilities] = useState<FacilityRequestData[]>([]);
  const [otherInvoiceFacilities, setOtherInvoiceFacilities] = useState("");

  // Current lenders
  const [lenders, setLenders] = useState<LenderData[]>([]);

  // Bank details
  const [bankDetails, setBankDetails] = useState<BankDetails>({ ...emptyBankDetails });

  // Documents
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [docNotes, setDocNotes] = useState<Record<string, string>>({});

  const isReadOnly = !["draft", "invited", "documents_requested", "documents_pending", "registered"].includes(onboardingStatus);
  const isSubmitted = ["documents_submitted", "under_review", "approved", "onboarded"].includes(onboardingStatus);

  // Load existing borrower data
  useEffect(() => {
    loadExistingData();
  }, [profile]);

  const loadExistingData = async () => {
    if (!profile?.user_id) return;
    setLoading(true);
    try {
      const { data: borrower } = await supabase
        .from("borrowers")
        .select("*")
        .eq("user_id", profile.user_id)
        .maybeSingle();

      if (borrower) {
        setBorrowerId(borrower.id);
        setOnboardingStatus(borrower.onboarding_status || "draft");

        // Populate company data
        setCompanyData({
          company_name: borrower.company_name || "",
          trading_name: borrower.trading_name || "",
          registration_number: borrower.registration_number || "",
          country: borrower.country || "",
          incorporation_date: borrower.incorporation_date || "",
          industry: borrower.industry || "",
          registered_address: (borrower.registered_address as any) || { ...emptyCompanyForm.registered_address },
          trading_address: (borrower.trading_address as any) || { ...emptyCompanyForm.trading_address },
          phone: borrower.phone || "",
          website: borrower.website || "",
          contact_email: borrower.contact_email || "",
          contact_name: borrower.contact_name || "",
          vat_tax_id: borrower.vat_tax_id || "",
          num_employees: borrower.num_employees?.toString() || "",
          annual_turnover: borrower.annual_turnover?.toString() || "",
          is_part_of_group: (borrower as any).is_part_of_group || false,
          parent_company_name: (borrower as any).parent_company_name || "",
          parent_shareholding_pct: (borrower as any).parent_shareholding_pct?.toString() || "",
          sic_codes: ((borrower as any).sic_codes || []).join(", "),
          has_credit_facilities: (borrower as any).has_credit_facilities || false,
          other_invoice_facilities: (borrower as any).other_invoice_facilities || "",
          turnover_currency: "GBP",
        });

        // Signatory data from metadata or specific fields
        const meta = (borrower.metadata as any) || {};
        if (meta.signatory) {
          setSignatoryData(meta.signatory);
        }
        // Restore NDA accepted state
        if (borrower.nda_signed) setNdaAccepted(true);
        if (meta.docNotes) setDocNotes(meta.docNotes);
        setOtherInvoiceFacilities((borrower as any).other_invoice_facilities || "");

        // Load directors
        const { data: dirs } = await supabase
          .from("borrower_directors")
          .select("*")
          .eq("borrower_id", borrower.id)
          .order("created_at");
        if (dirs && dirs.length > 0) {
          setDirectors(dirs.map((d: any) => ({
            id: d.id,
            first_name: d.first_name,
            middle_name: d.middle_name || "",
            last_name: d.last_name,
            date_of_birth: d.date_of_birth || "",
            nationality: d.nationality || "",
            role: d.role as any,
            shareholding_pct: d.shareholding_pct?.toString() || "",
            email: d.email || "",
            phone: d.phone || "",
            id_document_path: d.id_document_path || "",
            residential_address: (d.residential_address as any) || { ...emptyCompanyForm.registered_address },
          })));
        }

        // Load facility requests
        const { data: facs } = await supabase
          .from("facility_requests")
          .select("*")
          .eq("borrower_id", borrower.id)
          .order("created_at");
        if (facs && facs.length > 0) {
          setFacilities(facs.map((f: any) => ({
            facility_type: f.facility_type,
            amount: f.amount_requested?.toString() || "",
            currency: f.currency || "GBP",
            tenor_months: f.tenor_months?.toString() || "",
            pricing_notes: f.pricing_notes || "",
          })));
        }

        // Load lenders
        const { data: lnds } = await supabase
          .from("borrower_lenders")
          .select("*")
          .eq("borrower_id", borrower.id)
          .order("created_at");
        if (lnds && lnds.length > 0) {
          setLenders(lnds.map((l: any) => ({
            lender_name: l.lender_name,
            has_facilities: !!l.facility_nature,
            facility_nature: l.facility_nature || "",
            facility_amount: l.facility_amount?.toString() || "",
            currency: l.currency || "GBP",
            is_secured: l.is_secured || false,
            repayment_schedule: l.repayment_schedule || "",
          })));
        }

        // Load bank details from metadata
        if (meta.bankDetails) setBankDetails(meta.bankDetails);

        // Load uploaded docs from metadata
        if (meta.uploadedDocs) setUploadedDocs(meta.uploadedDocs);

        // If already submitted, start at review step
        if (["documents_submitted", "under_review", "approved", "onboarded"].includes(borrower.onboarding_status)) {
          setStep(7); // review step
        }
      }
    } catch (err) {
      console.error("Error loading onboarding data:", err);
    }
    setLoading(false);
  };

  const handleSave = useCallback(async (showToast = true) => {
    if (!profile?.user_id) return;
    setSaving(true);
    try {
      const orgId = profile.organization_id;
      if (!orgId) throw new Error("No organization found");

      const borrowerPayload = {
      company_name: companyData.company_name || "Unnamed Company",
        trading_name: companyData.trading_name,
        registration_number: companyData.registration_number,
        country: companyData.country,
        incorporation_date: companyData.incorporation_date || null,
        industry: companyData.industry,
        registered_address: companyData.registered_address as any,
        trading_address: companyData.trading_address as any,
        phone: companyData.phone,
        website: companyData.website,
        contact_email: companyData.contact_email || profile.email,
        contact_name: companyData.contact_name,
        vat_tax_id: companyData.vat_tax_id,
        num_employees: companyData.num_employees ? Number(companyData.num_employees) : null,
        annual_turnover: companyData.annual_turnover ? Number(companyData.annual_turnover) : null,
        is_part_of_group: companyData.is_part_of_group,
        parent_company_name: companyData.parent_company_name,
        parent_shareholding_pct: companyData.parent_shareholding_pct ? Number(companyData.parent_shareholding_pct) : null,
        sic_codes: companyData.sic_codes ? companyData.sic_codes.split(",").map(s => s.trim()).filter(Boolean) : [],
        has_credit_facilities: companyData.has_credit_facilities,
        other_invoice_facilities: otherInvoiceFacilities,
        signatory_name: signatoryData.full_name,
        signatory_designation: signatoryData.designation,
        signatory_dob: signatoryData.dob,
        signatory_is_director: signatoryData.is_director,
        signatory_email: signatoryData.is_director === false ? signatoryData.director_email : null,
        metadata: JSON.parse(JSON.stringify({
          signatory: signatoryData,
          bankDetails,
          uploadedDocs,
          docNotes,
        })),
        organization_id: orgId,
        user_id: profile.user_id,
      };

      let currentBorrowerId = borrowerId;

      if (borrowerId) {
        const { error } = await supabase
          .from("borrowers")
          .update(borrowerPayload as any)
          .eq("id", borrowerId);
        if (error) throw error;
      } else {
        const { data: newBorrower, error } = await supabase
          .from("borrowers")
          .insert(borrowerPayload as any)
          .select("id")
          .single();
        if (error) throw error;
        currentBorrowerId = newBorrower.id;
        setBorrowerId(newBorrower.id);
      }

      if (!currentBorrowerId) throw new Error("Failed to get borrower ID");

      // Save directors
      await supabase.from("borrower_directors").delete().eq("borrower_id", currentBorrowerId);
      if (directors.length > 0) {
        await supabase.from("borrower_directors").insert(
          directors.map(d => ({
            borrower_id: currentBorrowerId!,
            organization_id: orgId,
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
      }

      // Save facility requests
      await supabase.from("facility_requests").delete().eq("borrower_id", currentBorrowerId);
      if (facilities.length > 0) {
        await supabase.from("facility_requests").insert(
          facilities.map(f => ({
            borrower_id: currentBorrowerId!,
            organization_id: orgId,
            facility_type: f.facility_type,
            amount_requested: f.amount ? Number(f.amount) : null,
            currency: f.currency,
            tenor_months: f.tenor_months ? Number(f.tenor_months) : null,
            pricing_notes: f.pricing_notes || null,
          }))
        );
      }

      // Save lenders
      await supabase.from("borrower_lenders").delete().eq("borrower_id", currentBorrowerId);
      if (lenders.length > 0) {
        await supabase.from("borrower_lenders").insert(
          lenders.map(l => ({
            borrower_id: currentBorrowerId!,
            organization_id: orgId,
            lender_name: l.lender_name,
            facility_nature: l.has_facilities ? l.facility_nature : null,
            facility_amount: l.has_facilities && l.facility_amount ? Number(l.facility_amount) : null,
            currency: l.currency,
            is_secured: l.is_secured,
            repayment_schedule: l.has_facilities ? l.repayment_schedule : null,
          }))
        );
      }

      if (showToast) toast.success("Progress saved!");
    } catch (err: any) {
      toast.error("Save failed: " + err.message);
    }
    setSaving(false);
  }, [profile, borrowerId, companyData, directors, facilities, lenders, bankDetails, uploadedDocs, docNotes, signatoryData, otherInvoiceFacilities]);

  const handleSubmit = async () => {
    await handleSave(false);
    if (!borrowerId) return;
    const { error } = await supabase
      .from("borrowers")
      .update({ onboarding_status: "documents_submitted" })
      .eq("id", borrowerId);
    if (error) {
      toast.error("Submit failed: " + error.message);
      return;
    }
    setOnboardingStatus("documents_submitted");
    setStep(8); // complete
    toast.success("Application submitted for review!");

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: profile?.user_id,
      user_email: profile?.email,
      action: "borrower_onboarding_submitted",
      resource_type: "borrower",
      resource_id: borrowerId,
      details: { company_name: companyData.company_name },
    });
  };

  // NDA acknowledgment state
  const [ndaAccepted, setNdaAccepted] = useState(false);

  // Check if NDA was previously signed
  useEffect(() => {
    if (borrowerId) {
      const meta = (signatoryData as any);
      // Also check borrower.nda_signed from loaded data
    }
  }, [borrowerId]);

  const validateStep = () => {
    if (step === 0) {
      if (!signatoryData.full_name) { toast.error("Full name is required"); return false; }
      if (!signatoryData.designation) { toast.error("Designation is required"); return false; }
      if (signatoryData.is_director === null) { toast.error("Please indicate if you are a Director/Authorised Signatory"); return false; }
      if (signatoryData.is_director === false && !signatoryData.director_name) { toast.error("Director/Signatory name is required"); return false; }
      // NDA Gate: must acknowledge NDA before proceeding
      if (!ndaAccepted) { toast.error("You must accept the NDA to continue"); return false; }
    }
    if (step === 1) {
      if (!companyData.company_name) { toast.error("Company name is required"); return false; }
      if (!companyData.country) { toast.error("Country is required"); return false; }
      if (!companyData.contact_email) { toast.error("Email is required"); return false; }
      if (!companyData.registered_address.line1 || !companyData.registered_address.city) {
        toast.error("Registered address (line 1 & city) is required");
        return false;
      }
    }
    if (step === 3) {
      if (facilities.length === 0) { toast.error("Please add at least one facility request"); return false; }
      for (const f of facilities) {
        if (!f.facility_type) { toast.error("Facility type is required for all requests"); return false; }
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    // Auto-save on each step
    await handleSave(false);
    setStep(step + 1);
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  // Current status display
  const currentStatusObj = ONBOARDING_STATUSES.find(s => s.key === onboardingStatus) || ONBOARDING_STATUSES[0];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header with Status */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Borrower Onboarding</h1>
            <p className="text-muted-foreground">Complete all steps to submit your application</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={currentStatusObj.color as any} className="capitalize">
              {currentStatusObj.label}
            </Badge>
            {!isReadOnly && (
              <Button variant="outline" size="sm" onClick={() => handleSave(true)} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                Save
              </Button>
            )}
          </div>
        </div>

        {/* Status Progress Bar */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-1 overflow-x-auto">
            {ONBOARDING_STATUSES.filter(s => s.key !== "rejected").map((status, i, arr) => {
              const statusIdx = ONBOARDING_STATUSES.findIndex(s => s.key === onboardingStatus);
              const thisIdx = ONBOARDING_STATUSES.findIndex(s => s.key === status.key);
              const isActive = status.key === onboardingStatus;
              const isPast = thisIdx < statusIdx;

              return (
                <div key={status.key} className="flex items-center gap-1">
                  <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isPast
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {isPast && <CheckCircle2 className="h-3 w-3" />}
                    {status.label}
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`h-px w-4 ${isPast ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Originator comments (if any) */}
        {onboardingStatus === "documents_requested" && (
          <Card className="border-[hsl(var(--chart-4))]">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--chart-4))] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Additional Documents Requested</p>
                <p className="text-sm text-muted-foreground">Please upload the requested documents and resubmit.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step Progress */}
        {!isSubmitted && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
              <span className="font-medium text-foreground">{STEPS[step]?.label}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between">
              {STEPS.map((s, i) => (
                <div key={s.id} className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors ${
                      i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <s.icon className="h-4 w-4" />
                  </div>
                  <span className="hidden text-[10px] text-muted-foreground sm:block max-w-[60px] text-center leading-tight">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 0: Signatory Info + NDA Gate */}
        {step === 0 && (
          <>
            <SignatoryInfoStep data={signatoryData} onChange={setSignatoryData} disabled={isReadOnly} />
            {/* NDA Acceptance Gate */}
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileCheck className="h-4 w-4 text-primary" />
                  Non-Disclosure Agreement (NDA)
                </CardTitle>
                <CardDescription className="text-xs">
                  You must accept the NDA before proceeding with onboarding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground max-h-40 overflow-y-auto">
                  <p className="font-medium text-foreground mb-2">Confidentiality Agreement</p>
                  <p>By accepting this NDA, you agree to keep all information exchanged during the onboarding and financing process strictly confidential. This includes, but is not limited to, financial data, business strategies, customer information, and any proprietary materials shared between the parties.</p>
                  <p className="mt-2">This obligation of confidentiality shall survive the termination of any business relationship between the parties for a period of two (2) years.</p>
                  <p className="mt-2">Breach of this agreement may result in legal action and financial penalties as permitted by applicable law.</p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ndaAccepted}
                    onChange={(e) => {
                      setNdaAccepted(e.target.checked);
                      if (e.target.checked && borrowerId) {
                        // Mark NDA as signed on the borrower record
                        supabase.from("borrowers").update({
                          nda_signed: true,
                          nda_signed_at: new Date().toISOString(),
                        }).eq("id", borrowerId).then(() => {});
                      }
                    }}
                    disabled={isReadOnly}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm">
                    I, <strong>{signatoryData.full_name || "the undersigned"}</strong>, have read and accept the terms of the Non-Disclosure Agreement on behalf of the company.
                  </span>
                </label>
                {ndaAccepted && (
                  <Badge className="bg-green-600 text-xs">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> NDA Accepted
                  </Badge>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Step 1: Company Info */}
        {step === 1 && (
          <CompanyInfoStep data={companyData} onChange={setCompanyData} disabled={isReadOnly} />
        )}

        {/* Step 2: Directors */}
        {step === 2 && (
          <DirectorsStep directors={directors} onChange={setDirectors} disabled={isReadOnly} />
        )}

        {/* Step 3: Facility Requirements */}
        {step === 3 && (
          <FacilityRequirementsStep
            facilities={facilities}
            onChange={setFacilities}
            otherInvoiceFacilities={otherInvoiceFacilities}
            onOtherChange={setOtherInvoiceFacilities}
            disabled={isReadOnly}
          />
        )}

        {/* Step 4: Current Lenders */}
        {step === 4 && (
          <CurrentLendersStep lenders={lenders} onChange={setLenders} disabled={isReadOnly} />
        )}

        {/* Step 5: Bank Details */}
        {step === 5 && (
          <BankDetailsForm value={bankDetails} onChange={setBankDetails} disabled={isReadOnly} />
        )}

        {/* Step 6: Documents */}
        {step === 6 && (
          <DocumentChecklistStep
            uploadedDocs={uploadedDocs}
            onUpload={(doc) => setUploadedDocs(prev => [...prev, doc])}
            onDelete={(index) => setUploadedDocs(prev => prev.filter((_, i) => i !== index))}
            notes={docNotes}
            onNoteChange={(type, note) => setDocNotes(prev => ({ ...prev, [type]: note }))}
            disabled={isReadOnly}
            isSubmitted={isSubmitted}
          />
        )}

        {/* Step 7: Review & Submit */}
        {step === 7 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                {isSubmitted ? "Application Status" : "Review & Submit"}
              </CardTitle>
              <CardDescription>
                {isSubmitted
                  ? "Your application has been submitted and is being reviewed."
                  : "Review your application before submitting for review."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SummaryItem label="Company" value={companyData.company_name} />
                <SummaryItem label="Country" value={companyData.country} />
                <SummaryItem label="Reg Number" value={companyData.registration_number} />
                <SummaryItem label="Signatory" value={signatoryData.full_name} />
                <SummaryItem label="Directors" value={`${directors.length} added`} />
                <SummaryItem label="Facilities" value={`${facilities.length} requested`} />
                <SummaryItem label="Lenders" value={`${lenders.length} listed`} />
                <SummaryItem label="Documents" value={`${uploadedDocs.length} uploaded`} />
              </div>

              {!isSubmitted && (
                <div className="pt-4 border-t">
                  <Button className="w-full" size="lg" onClick={handleSubmit} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Submit Application for Review
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Once submitted, your data will be locked for review. You can still add documents if requested.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 8: Complete */}
        {step === 8 && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Application Submitted!</CardTitle>
              <CardDescription>
                Your application has been submitted and is under review. You'll receive a notification when the status changes.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Navigation */}
        {step < 8 && !isSubmitted && (
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            {step < 7 ? (
              <Button onClick={handleNext} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}

        {/* Navigation for submitted - allow stepping through to view */}
        {isSubmitted && step === 7 && (
          <div className="flex justify-center gap-2">
            {STEPS.slice(0, 7).map((s, i) => (
              <Button key={s.id} variant="outline" size="sm" onClick={() => setStep(i)}>
                {s.label}
              </Button>
            ))}
          </div>
        )}
        {isSubmitted && step < 7 && (
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button variant="outline" onClick={() => setStep(7)}>
              Back to Status
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}
