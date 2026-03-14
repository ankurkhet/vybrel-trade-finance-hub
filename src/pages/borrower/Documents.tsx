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
  { value: "kyc", label: "KYC Document" },
  { value: "financial_statement", label: "Financial Statement" },
  { value: "incorporation", label: "Certificate of Incorporation" },
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice" },
  { value: "other", label: "Other" },
];

export default function BorrowerDocuments() {
  const { user, profile } = useAuth();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>("kyc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchDocs();
  }, [user]);

  const fetchDocs = async () => {
    setLoading(true);
    // Get borrower record for current user
    const { data: borrower } = await supabase
      .from("borrowers")
      .select("id, organization_id")
      .eq("user_id", user!.id)
      .single();

    if (!borrower) { setLoading(false); return; }

    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("borrower_id", borrower.id)
      .order("created_at", { ascending: false });

    setDocs(data || []);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);

    const { data: borrower } = await supabase
      .from("borrowers")
      .select("id, organization_id")
      .eq("user_id", user.id)
      .single();

    if (!borrower) {
      toast.error("Borrower record not found");
      setUploading(false);
      return;
    }

    const filePath = `borrower/${borrower.id}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadErr) {
      toast.error(uploadErr.message);
      setUploading(false);
      return;
    }

    const { error } = await supabase.from("documents").insert({
      organization_id: borrower.organization_id,
      borrower_id: borrower.id,
      document_type: docType as any,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
    });

    if (error) toast.error(error.message);
    else toast.success(`"${file.name}" uploaded`);

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchDocs();
  };

  const statusIcon = (type: string) => {
    // Use metadata for review status if available
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Documents</h1>
          <p className="text-sm text-muted-foreground">Upload and manage your KYC & compliance documents</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Document</CardTitle>
            <CardDescription>Submit required documents for review</CardDescription>
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
            <CardTitle className="text-base">Submitted Documents</CardTitle>
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
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.document_type.replace(/_/g, " ")} · {new Date(doc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {doc.document_type.replace(/_/g, " ")}
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
