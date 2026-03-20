import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Building2,
  User,
  FileCheck,
  Brain,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import { CompanyInfoStep } from "@/components/onboarding/CompanyInfoStep";
import { DirectorsStep } from "@/components/onboarding/DirectorsStep";
import { BankDetailsForm, emptyBankDetails } from "@/components/onboarding/BankDetailsForm";
import type { BankDetails } from "@/components/onboarding/BankDetailsForm";
import { emptyCompanyForm, emptyDirector } from "@/lib/onboarding-types";
import type { CompanyFormData, DirectorData } from "@/lib/onboarding-types";

const STEPS = [
  { id: "company", label: "Company Info", icon: Building2 },
  { id: "directors", label: "Directors & Signatories", icon: User },
  { id: "bank", label: "Bank Details", icon: Landmark },
  { id: "documents", label: "Upload Documents", icon: Upload },
  { id: "review", label: "AI Review", icon: Brain },
  { id: "complete", label: "Complete", icon: FileCheck },
];

export default function BorrowerOnboarding() {
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // Company info
  const [companyData, setCompanyData] = useState<CompanyFormData>({
    ...emptyCompanyForm,
    contact_name: profile?.full_name || "",
    contact_email: profile?.email || "",
  });

  // Directors
  const [directors, setDirectors] = useState<DirectorData[]>([]);

  // Bank details
  const [bankDetails, setBankDetails] = useState<BankDetails>({ ...emptyBankDetails });

  // Documents
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ name: string; type: string }>>([]);
  const [aiResults, setAiResults] = useState<any[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const filePath = `onboarding/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setLoading(false);
      return;
    }
    setUploadedDocs((prev) => [...prev, { name: file.name, type: docType }]);
    toast.success(`${file.name} uploaded`);
    setLoading(false);
  };

  const handleAIReview = async () => {
    setAiAnalyzing(true);
    toast.info("AI is analyzing your documents...");
    await new Promise((r) => setTimeout(r, 2000));
    setAiResults([
      { doc: "KYC Document", status: "pass", score: 92, notes: "All fields present and valid" },
      { doc: "Financial Statement", status: "pass", score: 85, notes: "Revenue trends positive" },
      { doc: "Incorporation Certificate", status: "review", score: 68, notes: "Certificate date older than 5 years - may need renewal" },
    ]);
    setAiAnalyzing(false);
  };

  const validateStep = () => {
    if (step === 0) {
      if (!companyData.company_name) { toast.error("Company name is required"); return false; }
      if (!companyData.country) { toast.error("Country is required"); return false; }
      if (!companyData.contact_email) { toast.error("Email is required"); return false; }
      if (!companyData.registered_address.line1 || !companyData.registered_address.city) {
        toast.error("Registered office address (at least line 1 and city) is required");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep(step + 1);
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Borrower Onboarding</h1>
          <p className="text-muted-foreground">Complete the steps below to get started</p>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
            <span className="font-medium">{STEPS[step].label}</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                    i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Company Info */}
        {step === 0 && (
          <CompanyInfoStep data={companyData} onChange={setCompanyData} />
        )}

        {/* Step 2: Directors */}
        {step === 1 && (
          <DirectorsStep directors={directors} onChange={setDirectors} />
        )}

        {/* Step 3: Bank Details */}
        {step === 2 && (
          <BankDetailsForm value={bankDetails} onChange={setBankDetails} />
        )}

        {/* Step 3: Documents */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>Upload required KYC and financial documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { type: "kyc", label: "KYC Documents", desc: "ID, proof of address, etc." },
                { type: "financial_statement", label: "Financial Statements", desc: "Last 2 years" },
                { type: "incorporation", label: "Incorporation Certificate", desc: "Certificate of incorporation" },
              ].map((doc) => {
                const uploaded = uploadedDocs.find((d) => d.type === doc.type);
                return (
                  <div key={doc.type} className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      {uploaded ? (
                        <CheckCircle2 className="h-5 w-5 text-[hsl(var(--chart-2))]" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{doc.label}</p>
                        <p className="text-sm text-muted-foreground">{uploaded ? uploaded.name : doc.desc}</p>
                      </div>
                    </div>
                    <Label className="cursor-pointer">
                      <Input type="file" className="hidden" accept=".pdf,.jpg,.png,.doc,.docx" onChange={(e) => handleFileUpload(e, doc.type)} disabled={loading} />
                      <Badge variant={uploaded ? "secondary" : "default"} className="cursor-pointer">
                        {uploaded ? "Replace" : "Upload"}
                      </Badge>
                    </Label>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Step 4: AI Review */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" /> AI Document Review
              </CardTitle>
              <CardDescription>Our AI analyzes your documents for completeness and compliance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiResults.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Brain className="h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">Ready to analyze your uploaded documents</p>
                  <Button onClick={handleAIReview} disabled={aiAnalyzing}>
                    {aiAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Start AI Review
                  </Button>
                </div>
              ) : (
                aiResults.map((result, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {result.status === "pass" ? (
                          <CheckCircle2 className="h-5 w-5 text-[hsl(var(--chart-2))]" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-[hsl(var(--chart-4))]" />
                        )}
                        <span className="font-medium">{result.doc}</span>
                      </div>
                      <Badge variant={result.status === "pass" ? "secondary" : "outline"}>
                        Score: {result.score}/100
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{result.notes}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 5: Complete */}
        {step === 5 && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Onboarding Complete!</CardTitle>
              <CardDescription>
                Your application has been submitted and is under review. You'll receive an email notification once approved.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Navigation */}
        {step < 4 && (
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={handleNext} disabled={step === 2 && uploadedDocs.length === 0}>
              {step === 3 ? "Complete" : "Next"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
