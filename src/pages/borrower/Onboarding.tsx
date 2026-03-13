import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { analyzeDocument } from "@/lib/ai-services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { id: "company", label: "Company Info", icon: Building2 },
  { id: "contacts", label: "Contact Details", icon: User },
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
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [regNumber, setRegNumber] = useState("");

  // Contact
  const [contactName, setContactName] = useState(profile?.full_name || "");
  const [contactEmail, setContactEmail] = useState(profile?.email || "");
  const [contactPhone, setContactPhone] = useState("");

  // Documents
  const [uploadedDocs, setUploadedDocs] = useState<Array<{ name: string; type: string; id?: string }>>([]);
  const [aiResults, setAiResults] = useState<any[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const filePath = `onboarding/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Upload failed: " + uploadError.message);
      setLoading(false);
      return;
    }

    // We'll create the document record when we have the borrower ID
    setUploadedDocs((prev) => [...prev, { name: file.name, type: docType }]);
    toast.success(`${file.name} uploaded`);
    setLoading(false);
  };

  const handleAIReview = async () => {
    setAiAnalyzing(true);
    // Simulate AI analysis for onboarding docs
    // In production, this would iterate over uploaded doc IDs
    toast.info("AI is analyzing your documents...");
    await new Promise((r) => setTimeout(r, 2000));
    setAiResults([
      { doc: "KYC Document", status: "pass", score: 92, notes: "All fields present and valid" },
      { doc: "Financial Statement", status: "pass", score: 85, notes: "Revenue trends positive" },
      { doc: "Incorporation Certificate", status: "review", score: 68, notes: "Certificate date older than 5 years - may need renewal" },
    ]);
    setAiAnalyzing(false);
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

        {/* Step Content */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Tell us about your company</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="agriculture">Agriculture</SelectItem>
                      <SelectItem value="construction">Construction</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="United States" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Registration Number</Label>
                <Input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder="Company registration #" />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
              <CardDescription>Primary contact for this borrower</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
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
                        <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{doc.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {uploaded ? uploaded.name : doc.desc}
                        </p>
                      </div>
                    </div>
                    <Label className="cursor-pointer">
                      <Input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.png,.doc,.docx"
                        onChange={(e) => handleFileUpload(e, doc.type)}
                        disabled={loading}
                      />
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

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Document Review
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
                          <CheckCircle2 className="h-5 w-5 text-[hsl(var(--success))]" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))]" />
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

        {step === 4 && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--success))]/10">
                <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
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
            <Button onClick={() => setStep(step + 1)} disabled={step === 2 && uploadedDocs.length === 0}>
              {step === 3 ? "Complete" : "Next"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
