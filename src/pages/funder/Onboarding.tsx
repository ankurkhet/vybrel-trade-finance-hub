import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Loader2, Building2, Shield, Upload, CheckCircle2, FileText, AlertTriangle, Landmark, Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ENTITY_TYPES = [
  { value: "bank", label: "Bank / Credit Institution" },
  { value: "nbfi", label: "Non-Bank Financial Institution" },
  { value: "fund", label: "Investment Fund / LP" },
  { value: "corporate", label: "Corporate Treasury" },
  { value: "other", label: "Other" },
];

const COUNTRIES = [
  "United Kingdom", "United States", "United Arab Emirates", "Singapore", "Hong Kong",
  "Luxembourg", "Ireland", "Netherlands", "Germany", "France", "Switzerland", "India", "Other"
];

interface FunderKYCData {
  entity_name: string;
  entity_type: string;
  registration_number: string;
  country_of_incorporation: string;
  registered_address: string;
  regulatory_status: string;
  regulator_name: string;
  licence_number: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_sort_code: string;
  bank_iban: string;
  bank_swift: string;
  aml_policy_confirmed: boolean;
  pep_screening_confirmed: boolean;
  sanctions_screening_confirmed: boolean;
  notes: string;
}

const emptyKYC: FunderKYCData = {
  entity_name: "", entity_type: "", registration_number: "",
  country_of_incorporation: "United Kingdom", registered_address: "",
  regulatory_status: "", regulator_name: "", licence_number: "",
  contact_name: "", contact_email: "", contact_phone: "",
  bank_name: "", bank_account_name: "", bank_account_number: "",
  bank_sort_code: "", bank_iban: "", bank_swift: "",
  aml_policy_confirmed: false, pep_screening_confirmed: false, sanctions_screening_confirmed: false,
  notes: "",
};

export default function FunderOnboarding() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("entity");
  const [form, setForm] = useState<FunderKYCData>({ ...emptyKYC });
  const [kycStatus, setKycStatus] = useState<string>("not_started");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) loadKYC();
  }, [user]);

  const loadKYC = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("funder_kyc")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (data) {
      setExistingId(data.id);
      setKycStatus(data.status || "draft");
      setForm({
        entity_name: data.entity_name || "",
        entity_type: data.entity_type || "",
        registration_number: data.registration_number || "",
        country_of_incorporation: data.country_of_incorporation || "United Kingdom",
        registered_address: data.registered_address || "",
        regulatory_status: data.regulatory_status || "",
        regulator_name: data.regulator_name || "",
        licence_number: data.licence_number || "",
        contact_name: data.contact_name || "",
        contact_email: data.contact_email || user?.email || "",
        contact_phone: data.contact_phone || "",
        bank_name: data.bank_name || "",
        bank_account_name: data.bank_account_name || "",
        bank_account_number: data.bank_account_number || "",
        bank_sort_code: data.bank_sort_code || "",
        bank_iban: data.bank_iban || "",
        bank_swift: data.bank_swift || "",
        aml_policy_confirmed: data.aml_policy_confirmed || false,
        pep_screening_confirmed: data.pep_screening_confirmed || false,
        sanctions_screening_confirmed: data.sanctions_screening_confirmed || false,
        notes: data.notes || "",
      });
    } else {
      setForm(f => ({ ...f, contact_email: user?.email || "" }));
    }

    // Load uploaded KYC docs
    const { data: kycDocs } = await supabase
      .from("documents")
      .select("id, file_name, file_path, document_type, created_at, status")
      .eq("uploaded_by", user!.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });
    setDocs(kycDocs || []);

    setLoading(false);
  };

  const handleSave = async (submit = false) => {
    if (!form.entity_name || !form.entity_type) {
      toast.error("Entity name and type are required");
      return;
    }
    if (submit && (!form.bank_name || !form.bank_account_number)) {
      toast.error("Banking details are required for submission");
      return;
    }
    if (submit && !form.aml_policy_confirmed) {
      toast.error("AML/KYC compliance confirmations are required for submission");
      return;
    }

    setSubmitting(true);
    const payload = {
      user_id: user!.id,
      organization_id: profile?.organization_id,
      status: submit ? "submitted" : "draft",
      ...form,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase.from("funder_kyc").update(payload as any).eq("id", existingId));
    } else {
      ({ error } = await supabase.from("funder_kyc" as any).insert(payload));
    }

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(submit ? "KYC submitted for review" : "Draft saved");
      if (submit) setKycStatus("submitted");
      await supabase.from("audit_logs").insert({
        user_id: user!.id, user_email: user?.email,
        action: submit ? "funder_kyc_submitted" : "funder_kyc_saved",
        resource_type: "funder_kyc",
        details: { entity_name: form.entity_name, entity_type: form.entity_type },
      });
      await loadKYC();
    }
    setSubmitting(false);
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const filePath = `funder_kyc/${user!.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(filePath, file);
    if (upErr) { toast.error("Upload failed"); setUploading(false); return; }

    await supabase.from("documents").insert({
      organization_id: profile?.organization_id,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      document_type: "kyc" as any,
      uploaded_by: user!.id,
      metadata: { purpose: "funder_kyc" },
    });

    toast.success("Document uploaded");
    setUploading(false);
    loadKYC();
  };

  const statusBanner = () => {
    switch (kycStatus) {
      case "approved":
        return (
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold text-green-700 dark:text-green-300">KYC Approved</p>
              <p className="text-sm text-green-600/80 dark:text-green-400/80">Your entity has been verified. You may participate in the marketplace.</p>
            </div>
          </div>
        );
      case "submitted":
        return (
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800">
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-semibold text-blue-700 dark:text-blue-300">Under Review</p>
              <p className="text-sm text-blue-600/80 dark:text-blue-400/80">Your KYC application has been submitted and is being reviewed by the compliance team.</p>
            </div>
          </div>
        );
      case "rejected":
        return (
          <div className="flex items-center gap-3 p-4 rounded-lg border bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-300">Rejected</p>
              <p className="text-sm text-red-600/80 dark:text-red-400/80">Your KYC application was rejected. Please update your details and re-submit.</p>
            </div>
          </div>
        );
      default: return null;
    }
  };

  const isEditable = kycStatus !== "approved" && kycStatus !== "submitted";

  if (loading) return <DashboardLayout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Funder Onboarding & KYC</h1>
          <p className="text-sm text-muted-foreground">Complete your entity verification to participate in the trade finance marketplace</p>
        </div>

        {statusBanner()}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="entity"><Building2 className="h-4 w-4 mr-1" /> Entity</TabsTrigger>
            <TabsTrigger value="compliance"><Shield className="h-4 w-4 mr-1" /> Compliance</TabsTrigger>
            <TabsTrigger value="banking"><Landmark className="h-4 w-4 mr-1" /> Banking</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="h-4 w-4 mr-1" /> Documents</TabsTrigger>
          </TabsList>

          {/* Entity Tab */}
          <TabsContent value="entity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Entity Information</CardTitle>
                <CardDescription>Legal entity details for KYC/KYB verification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Legal Entity Name *</Label>
                    <Input value={form.entity_name} onChange={e => setForm(f => ({ ...f, entity_name: e.target.value }))} disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>Entity Type *</Label>
                    <Select value={form.entity_type} onValueChange={v => setForm(f => ({ ...f, entity_type: v }))} disabled={!isEditable}>
                      <SelectTrigger><SelectValue placeholder="Select entity type" /></SelectTrigger>
                      <SelectContent>
                        {ENTITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Registration / Company Number</Label>
                    <Input value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))} disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>Country of Incorporation</Label>
                    <Select value={form.country_of_incorporation} onValueChange={v => setForm(f => ({ ...f, country_of_incorporation: v }))} disabled={!isEditable}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Registered Address</Label>
                  <Textarea value={form.registered_address} onChange={e => setForm(f => ({ ...f, registered_address: e.target.value }))} rows={2} disabled={!isEditable} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Name</Label>
                    <Input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} disabled={!isEditable} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Regulatory & Compliance</CardTitle>
                <CardDescription>AML/KYC compliance declarations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Regulatory Status</Label>
                    <Input value={form.regulatory_status} onChange={e => setForm(f => ({ ...f, regulatory_status: e.target.value }))} placeholder="e.g., FCA Authorised" disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>Regulator Name</Label>
                    <Input value={form.regulator_name} onChange={e => setForm(f => ({ ...f, regulator_name: e.target.value }))} placeholder="e.g., FCA, MAS" disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>Licence Number</Label>
                    <Input value={form.licence_number} onChange={e => setForm(f => ({ ...f, licence_number: e.target.value }))} disabled={!isEditable} />
                  </div>
                </div>
                
                <Separator />
                
                <h4 className="text-sm font-semibold">Compliance Confirmations</h4>
                <div className="space-y-3">
                  {[
                    { key: "aml_policy_confirmed", label: "I confirm that our entity has an AML/CFT policy in place and we conduct ongoing customer due diligence." },
                    { key: "pep_screening_confirmed", label: "I confirm that we screen all beneficial owners against PEP and sanctions lists." },
                    { key: "sanctions_screening_confirmed", label: "I confirm that our entity is not subject to any sanctions or enforcement actions." },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(form as any)[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                        disabled={!isEditable}
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-muted-foreground">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Additional Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} disabled={!isEditable} placeholder="Any additional compliance or operational notes..." />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Banking Tab */}
          <TabsContent value="banking" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Settlement Banking Details</CardTitle>
                <CardDescription>Where settlement payments will be directed</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name *</Label>
                    <Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Name</Label>
                    <Input value={form.bank_account_name} onChange={e => setForm(f => ({ ...f, bank_account_name: e.target.value }))} disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number *</Label>
                    <Input value={form.bank_account_number} onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))} disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sort Code</Label>
                    <Input value={form.bank_sort_code} onChange={e => setForm(f => ({ ...f, bank_sort_code: e.target.value }))} disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>IBAN</Label>
                    <Input value={form.bank_iban} onChange={e => setForm(f => ({ ...f, bank_iban: e.target.value }))} disabled={!isEditable} />
                  </div>
                  <div className="space-y-2">
                    <Label>SWIFT / BIC</Label>
                    <Input value={form.bank_swift} onChange={e => setForm(f => ({ ...f, bank_swift: e.target.value }))} disabled={!isEditable} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Supporting Documents</CardTitle>
                  <CardDescription>Upload incorporation certificate, AML policy, board resolution, etc.</CardDescription>
                </div>
                {isEditable && (
                  <Button variant="outline" className="relative" disabled={uploading}>
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload Document"}
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleDocUpload}
                      accept=".pdf,.doc,.docx,.jpg,.png"
                    />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {docs.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
                    No documents uploaded yet. Upload your incorporation certificate, AML policy, and any regulatory licences.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {docs.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Badge variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">
                          {doc.status || "pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        {isEditable && (
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={submitting}>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button onClick={() => handleSave(true)} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit for Review
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
