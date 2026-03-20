import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Upload, Loader2, CheckCircle2, XCircle, Clock, FileText, AlertCircle, ChevronDown, ChevronRight, History } from "lucide-react";
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

interface OrgDoc {
  id: string;
  document_type: string;
  document_label: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
  version: number;
  status: string;
  review_notes: string | null;
  is_deleted: boolean;
  created_at: string;
}

export default function OriginatorDocuments() {
  const { profile, user, isAdmin } = useAuth();
  const [docs, setDocs] = useState<OrgDoc[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(DOC_TYPES.map(d => d.value)));
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (profile?.organization_id) fetchData();
    else setLoading(false);
  }, [profile]);

  const fetchData = async () => {
    const [orgRes, docsRes] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", profile.organization_id).single(),
      supabase
        .from("org_documents")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
    ]);
    if (orgRes.data) setOrg(orgRes.data);
    if (docsRes.data) setDocs(docsRes.data as OrgDoc[]);
    setLoading(false);
  };

  const handleUpload = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.organization_id) return;
    setUploading(docType);

    const filePath = `${profile.organization_id}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("org-documents").upload(filePath, file);
    if (uploadErr) { toast.error(uploadErr.message); setUploading(null); return; }

    const existingDocs = docs.filter(d => d.document_type === docType);
    const maxVersion = existingDocs.length > 0 ? Math.max(...existingDocs.map(d => d.version)) : 0;
    const label = notes[docType] || DOC_TYPES.find(d => d.value === docType)?.label || docType;

    await supabase.from("org_documents").insert({
      organization_id: profile.organization_id,
      document_type: docType,
      document_label: label,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user?.id || null,
      notes: notes[docType] || null,
      version: maxVersion + 1,
      status: "pending",
    });

    toast.success(`"${file.name}" uploaded successfully`);
    setNotes(prev => ({ ...prev, [docType]: "" }));
    setUploading(null);
    if (fileInputRefs.current[docType]) fileInputRefs.current[docType]!.value = "";
    fetchData();
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
                        {latestDoc?.status === "rejected" && latestDoc.review_notes && (
                          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-destructive">Document Rejected</p>
                                <p className="text-xs text-muted-foreground mt-1">{latestDoc.review_notes}</p>
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
                              placeholder="e.g. 2025 certified copy"
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
                                    {doc.status === "rejected" && doc.review_notes && (
                                      <p className="text-xs text-destructive mt-0.5">Reason: {doc.review_notes}</p>
                                    )}
                                  </div>
                                </div>
                                <Badge variant={statusBadgeVariant(doc.status)} className="text-xs capitalize">
                                  {doc.status}
                                </Badge>
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
      </div>
    </DashboardLayout>
  );
}
