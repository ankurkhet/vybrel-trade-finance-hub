import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2, CheckCircle2, XCircle, Clock, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const DOC_TYPES = [
  { value: "certificate_of_incorporation", label: "Certificate of Incorporation" },
  { value: "tax_registration", label: "Tax Registration" },
  { value: "board_resolution", label: "Board Resolution" },
  { value: "kyc_directors", label: "KYC — Directors/Shareholders" },
  { value: "aml_policy", label: "AML/CFT Policy" },
  { value: "financial_statements", label: "Audited Financial Statements" },
  { value: "business_license", label: "Business License" },
  { value: "other", label: "Other" },
];

export default function OriginatorDocuments() {
  const { profile, user } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("certificate_of_incorporation");
  const [docLabel, setDocLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.organization_id) fetchData();
    else setLoading(false);
  }, [profile]);

  const fetchData = async () => {
    const [orgRes, docsRes] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", profile.organization_id).single(),
      supabase.from("org_documents" as any).select("*").eq("organization_id", profile.organization_id).order("created_at", { ascending: false }),
    ]);
    if (orgRes.data) setOrg(orgRes.data);
    if (docsRes.data) setDocs(docsRes.data as any[]);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.organization_id) return;
    setUploading(true);

    const filePath = `${profile.organization_id}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("org-documents").upload(filePath, file);
    if (uploadErr) { toast.error(uploadErr.message); setUploading(false); return; }

    const label = docLabel || DOC_TYPES.find((d) => d.value === docType)?.label || docType;
    await supabase.from("org_documents" as any).insert({
      organization_id: profile.organization_id,
      document_type: docType,
      document_label: label,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user?.id || null,
    });

    toast.success(`"${file.name}" uploaded successfully`);
    setDocLabel("");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData();
  };

  const docStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "rejected": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  if (!profile?.organization_id) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">No organization assigned</p>
          <p className="text-sm text-muted-foreground">Contact your administrator.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">KYC/KYB Documents</h1>
          <p className="text-sm text-muted-foreground">
            Upload your organization's compliance documents for review by Vybrel
          </p>
          {org && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{org.onboarding_status?.replace(/_/g, " ")}</Badge>
              {org.is_active && <Badge className="bg-green-600">Active</Badge>}
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload New Document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Label (optional)</Label>
                <Input placeholder="e.g. 2024 Annual Report" value={docLabel}
                  onChange={(e) => setDocLabel(e.target.value)} />
              </div>
            </div>
            <div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload}
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {uploading ? "Uploading..." : "Choose File & Upload"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Documents</CardTitle>
            <CardDescription>Documents are reviewed by Vybrel for compliance approval</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center py-8">
                <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      {docStatusIcon(doc.status)}
                      <div>
                        <p className="text-sm font-medium text-foreground">{doc.document_label}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.file_name} · {doc.document_type.replace(/_/g, " ")}
                        </p>
                        {doc.review_notes && doc.status === "rejected" && (
                          <p className="text-xs text-destructive mt-0.5">Reason: {doc.review_notes}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
