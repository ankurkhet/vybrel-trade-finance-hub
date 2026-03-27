import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, Loader2, CheckCircle2, XCircle, Clock, FileText, AlertCircle, ChevronDown, ChevronRight, History, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { DocumentPreviewModal, useDocumentPreview } from "@/components/ui/document-preview-modal";

const DOC_TYPES = [
  { value: "kyc", label: "KYC Document" },
  { value: "financial_statement", label: "Financial Statement" },
  { value: "incorporation", label: "Certificate of Incorporation" },
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice" },
  { value: "other", label: "Other" },
];

interface Doc {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  version: number;
  status: string;
  rejection_reason: string | null;
  parent_document_id: string | null;
  is_deleted: boolean;
  created_at: string;
}

export default function BorrowerDocuments() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(DOC_TYPES.map(d => d.value)));
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [borrower, setBorrower] = useState<any>(null);
  const { preview, openPreview, closePreview } = useDocumentPreview();

  useEffect(() => {
    if (user) fetchDocs();
  }, [user]);

  const fetchDocs = async () => {
    setLoading(true);
    const { data: b } = await supabase
      .from("borrowers")
      .select("id, organization_id")
      .eq("user_id", user!.id)
      .single();

    if (!b) { setLoading(false); return; }
    setBorrower(b);

    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("borrower_id", b.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    setDocs((data || []) as Doc[]);
    setLoading(false);
  };

  const handleUpload = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !borrower) return;
    setUploading(docType);

    const filePath = `borrower/${borrower.id}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(filePath, file);

    if (uploadErr) {
      toast.error(uploadErr.message);
      setUploading(null);
      return;
    }

    // Find existing docs of same type to determine version
    const existingDocs = docs.filter(d => d.document_type === docType);
    const maxVersion = existingDocs.length > 0 ? Math.max(...existingDocs.map(d => d.version)) : 0;

    const { error } = await supabase.from("documents").insert({
      organization_id: borrower.organization_id,
      borrower_id: borrower.id,
      document_type: docType as any,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
      notes: notes[docType] || null,
      version: maxVersion + 1,
      status: "pending",
    });

    if (error) toast.error(error.message);
    else toast.success(`"${file.name}" uploaded`);

    setUploading(null);
    setNotes(prev => ({ ...prev, [docType]: "" }));
    if (fileInputRefs.current[docType]) fileInputRefs.current[docType]!.value = "";
    fetchDocs();
  };

  const toggleType = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "rejected": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const statusBadgeVariant = (status: string): "default" | "destructive" | "secondary" => {
    switch (status) {
      case "approved": return "default";
      case "rejected": return "destructive";
      default: return "secondary";
    }
  };

  const getDocsForType = (type: string) => docs.filter(d => d.document_type === type);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Documents</h1>
          <p className="text-sm text-muted-foreground">Upload and manage your KYC & compliance documents</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {DOC_TYPES.map((docType) => {
              const typeDocs = getDocsForType(docType.value);
              const isOpen = expandedTypes.has(docType.value);
              const latestDoc = typeDocs[0];
              const hasRejected = typeDocs.some(d => d.status === "rejected");
              const hasApproved = typeDocs.some(d => d.status === "approved");

              return (
                <Card key={docType.value}>
                  <Collapsible open={isOpen} onOpenChange={() => toggleType(docType.value)}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
                        <CardTitle className="flex items-center gap-3 text-sm font-medium">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <FileText className="h-4 w-4 text-primary" />
                          {docType.label}
                          <div className="ml-auto flex items-center gap-2">
                            {typeDocs.length > 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                {typeDocs.length} upload{typeDocs.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            {hasApproved && <Badge className="bg-green-600 text-[10px]">Approved</Badge>}
                            {hasRejected && !hasApproved && <Badge variant="destructive" className="text-[10px]">Action Required</Badge>}
                            {!latestDoc && <Badge variant="outline" className="text-[10px]">Not uploaded</Badge>}
                          </div>
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 space-y-4">
                        {/* Rejection notice */}
                        {latestDoc?.status === "rejected" && latestDoc.rejection_reason && (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-destructive">Document Rejected</p>
                                <p className="text-xs text-muted-foreground mt-1">{latestDoc.rejection_reason}</p>
                                <p className="text-xs text-muted-foreground mt-1">Please upload a corrected version below.</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Upload section */}
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1 space-y-1.5">
                            <Label className="text-xs">Notes (optional)</Label>
                            <Input
                              placeholder="e.g. Q4 2025 statements"
                              value={notes[docType.value] || ""}
                              onChange={(e) => setNotes(prev => ({ ...prev, [docType.value]: e.target.value }))}
                            />
                          </div>
                          <div className="flex items-end">
                            <input
                              ref={(el) => { fileInputRefs.current[docType.value] = el; }}
                              type="file"
                              className="hidden"
                              onChange={(e) => handleUpload(docType.value, e)}
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRefs.current[docType.value]?.click()}
                              disabled={uploading === docType.value}
                            >
                              {uploading === docType.value ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="mr-2 h-3.5 w-3.5" />
                              )}
                              Upload
                            </Button>
                          </div>
                        </div>

                        {/* Document history */}
                        {typeDocs.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <History className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-medium text-muted-foreground">Upload History</span>
                            </div>
                            {typeDocs.map((doc) => (
                              <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                                <div className="flex items-center gap-3">
                                  {statusIcon(doc.status)}
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{doc.file_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      v{doc.version} · {new Date(doc.created_at).toLocaleDateString()}
                                      {doc.notes && ` · ${doc.notes}`}
                                    </p>
                                    {doc.status === "rejected" && doc.rejection_reason && (
                                      <p className="text-xs text-destructive mt-0.5">Reason: {doc.rejection_reason}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openPreview(doc.file_path, doc.file_name, doc.mime_type)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Badge variant={statusBadgeVariant(doc.status)} className="text-xs capitalize">
                                    {doc.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}

        {preview && (
          <DocumentPreviewModal
            open={!!preview}
            onOpenChange={(open) => !open && closePreview()}
            filePath={preview.filePath}
            fileName={preview.fileName}
            mimeType={preview.mimeType}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
