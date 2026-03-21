import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Users, FileText, Upload, CheckCircle2, XCircle, Clock,
  Loader2, Copy, Eye, Shield, AlertTriangle, Trash2, PauseCircle, RotateCcw, Brain, Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Document types with proper Company/Individual prefixes, sorted alphabetically
const DOC_TYPES = [
  { value: "aml_policy", label: "Company - AML/CFT Policy" },
  { value: "board_resolution", label: "Company - Board Resolution" },
  { value: "business_license", label: "Company - Business License" },
  { value: "certificate_of_incorporation", label: "Company - Certificate of Incorporation" },
  { value: "financial_statements", label: "Company - Financial Statements (Audited)" },
  { value: "insurance_certificate", label: "Company - Insurance Certificate" },
  { value: "kyc_directors", label: "Company - KYC — Directors/Shareholders" },
  { value: "memorandum_of_association", label: "Company - Memorandum of Association" },
  { value: "power_of_attorney", label: "Company - Power of Attorney" },
  { value: "proof_of_address", label: "Company - Proof of Address" },
  { value: "regulatory_license", label: "Company - Regulatory License" },
  { value: "shareholder_agreement", label: "Company - Shareholder Agreement" },
  { value: "tax_registration", label: "Company - Tax Registration" },
  { value: "individual_bank_statement", label: "Individual - Bank Statement" },
  { value: "individual_driving_license", label: "Individual - Driving License" },
  { value: "individual_passport", label: "Individual - Passport" },
  { value: "individual_utility_statement", label: "Individual - Utility Statement" },
  { value: "other", label: "Other" },
];

interface OrgDetailPanelProps {
  orgId: string;
  onBack: () => void;
}

export function OrgDetailPanel({ orgId, onBack }: OrgDetailPanelProps) {
  const [org, setOrg] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDoc, setReviewDoc] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState("contacts");
  
  // Contact management
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [contactForm, setContactForm] = useState({ full_name: "", email: "", designation: "", is_primary: false });

  // Upload state with preview
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadDocType, setUploadDocType] = useState("certificate_of_incorporation");
  const [uploadDocLabel, setUploadDocLabel] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  // AI validation
  const [aiValidating, setAiValidating] = useState(false);
  const [aiValidationResult, setAiValidationResult] = useState<any>(null);
  const [showMismatchDialog, setShowMismatchDialog] = useState(false);

  // Delete confirmation
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Show rejected docs
  const [showRejected, setShowRejected] = useState(false);

  useEffect(() => { fetchAll(); }, [orgId]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const fetchAll = async () => {
    setLoading(true);
    const [orgRes, contactsRes, docsRes, invRes] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", orgId).single(),
      supabase.from("org_contacts" as any).select("*").eq("organization_id", orgId).order("is_primary", { ascending: false }),
      supabase.from("org_documents" as any).select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("invitations").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    ]);
    if (orgRes.data) setOrg(orgRes.data);
    if (contactsRes.data) setContacts(contactsRes.data as any[]);
    if (docsRes.data) setDocs(docsRes.data as any[]);
    if (invRes.data) setInvitations(invRes.data);
    setLoading(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);

    // Generate preview
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    if (file.type.startsWith("image/")) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }

    // Auto-set label if empty
    if (!uploadDocLabel) {
      const docType = DOC_TYPES.find((d) => d.value === uploadDocType);
      setUploadDocLabel(docType?.label || "");
    }
  };

  const runAiValidation = async () => {
    if (!selectedFile) return;
    setAiValidating(true);
    setAiValidationResult(null);

    try {
      const docType = DOC_TYPES.find((d) => d.value === uploadDocType);
      const { data, error } = await supabase.functions.invoke("ai-validate-doc-type", {
        body: {
          file_name: selectedFile.name,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          expected_doc_type: uploadDocType,
          expected_doc_label: docType?.label || uploadDocType,
        },
      });

      if (error) throw error;
      setAiValidationResult(data);

      if (!data.matches && data.confidence > 60) {
        setShowMismatchDialog(true);
      }
    } catch (err) {
      console.error("AI validation error:", err);
      // Don't block upload if AI validation fails
    } finally {
      setAiValidating(false);
    }
  };

  const confirmUpload = async (overrideDocType?: string) => {
    if (!selectedFile) return;
    setUploading(true);
    setShowMismatchDialog(false);

    const finalDocType = overrideDocType || uploadDocType;
    const filePath = `${orgId}/${Date.now()}_${selectedFile.name}`;
    const { error: uploadErr } = await supabase.storage.from("org-documents").upload(filePath, selectedFile);

    if (uploadErr) { toast.error(uploadErr.message); setUploading(false); return; }

    const { data: session } = await supabase.auth.getSession();
    const docTypeObj = DOC_TYPES.find((d) => d.value === finalDocType);
    const label = uploadDocLabel || docTypeObj?.label || finalDocType;

    await supabase.from("org_documents" as any).insert({
      organization_id: orgId,
      document_type: finalDocType,
      document_label: label,
      file_name: selectedFile.name,
      file_path: filePath,
      file_size: selectedFile.size,
      mime_type: selectedFile.type,
      uploaded_by: session.session?.user?.id || null,
    });

    toast.success(`"${selectedFile.name}" uploaded successfully`);
    resetUploadForm();
    setUploading(false);
    fetchAll();
  };

  const resetUploadForm = () => {
    setSelectedFile(null);
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(null);
    setUploadDocLabel("");
    setAiValidationResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReview = async (status: "approved" | "rejected") => {
    if (!reviewDoc) return;
    setStatusUpdating(true);
    const { data: session } = await supabase.auth.getSession();

    await supabase.from("org_documents" as any).update({
      status,
      review_notes: reviewNotes || null,
      reviewed_by: session.session?.user?.id || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", reviewDoc.id);

    toast.success(`Document ${status}`);
    setReviewOpen(false);
    setReviewDoc(null);
    setReviewNotes("");
    setStatusUpdating(false);
    fetchAll();
  };

  const handleDeleteDoc = async () => {
    if (!deleteDocId) return;
    setStatusUpdating(true);

    // Soft delete: mark as deleted but keep audit trail
    await supabase.from("org_documents" as any).update({
      status: "deleted",
      review_notes: `Deleted by admin on ${new Date().toISOString()}. Previous status preserved in audit log.`,
    }).eq("id", deleteDocId);

    toast.success("Document removed (audit trail preserved)");
    setDeleteConfirmOpen(false);
    setDeleteDocId(null);
    setStatusUpdating(false);
    fetchAll();
  };

  const handleOrgStatusChange = async (newStatus: string) => {
    setStatusUpdating(true);
    const updates: any = { onboarding_status: newStatus };
    if (newStatus === "approved") updates.is_active = true;
    if (newStatus === "rejected") updates.is_active = false;
    if (newStatus === "on_hold") updates.is_active = false;

    await supabase.from("organizations").update(updates).eq("id", orgId);
    toast.success(`Organization status updated to "${newStatus.replace(/_/g, " ")}"`);
    setStatusUpdating(false);
    fetchAll();
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/accept?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invitation link copied to clipboard");
  };

  const handleSaveContact = async () => {
    const payload = {
      full_name: contactForm.full_name,
      email: contactForm.email,
      designation: contactForm.designation,
      is_primary: contactForm.is_primary,
      organization_id: orgId,
    };
    if (editingContact) {
      await supabase.from("org_contacts" as any).update(payload).eq("id", editingContact.id);
      toast.success("Contact updated");
    } else {
      await supabase.from("org_contacts" as any).insert(payload);
      toast.success("Contact added");
    }
    setContactDialogOpen(false);
    fetchAll();
  };

  const handleDeleteContact = async (contactId: string) => {
    await supabase.from("org_contacts" as any).delete().eq("id", contactId);
    toast.success("Contact removed");
    fetchAll();
  };

  const docStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "rejected": return <XCircle className="h-4 w-4 text-destructive" />;
      case "deleted": return <Trash2 className="h-4 w-4 text-muted-foreground" />;
      default: return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!org) return <p className="text-muted-foreground">Organization not found.</p>;

  const activeDocs = docs.filter((d: any) => d.status !== "deleted");
  const rejectedDocs = docs.filter((d: any) => d.status === "rejected");
  const deletedDocs = docs.filter((d: any) => d.status === "deleted");
  const allDocsApproved = activeDocs.length > 0 && activeDocs.every((d: any) => d.status === "approved");
  const canApprove = allDocsApproved && org.onboarding_status !== "approved";
  const isOnHold = org.onboarding_status === "on_hold";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
          <p className="text-sm text-muted-foreground">/{org.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          {isOnHold && <Badge className="bg-orange-600">On Hold</Badge>}
          <Badge variant={org.is_active ? "default" : "secondary"}>
            {org.is_active ? "Active" : "Inactive"}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {org.onboarding_status?.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="contacts"><Users className="mr-1.5 h-3.5 w-3.5" />Contacts & Invites</TabsTrigger>
          <TabsTrigger value="documents"><FileText className="mr-1.5 h-3.5 w-3.5" />KYC/KYB Documents</TabsTrigger>
          <TabsTrigger value="approval"><Shield className="mr-1.5 h-3.5 w-3.5" />Approval</TabsTrigger>
        </TabsList>

        {/* CONTACTS TAB */}
        <TabsContent value="contacts" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Contact Persons</CardTitle>
                <Button variant="outline" size="sm" onClick={() => { setEditingContact(null); setContactForm({ full_name: "", email: "", designation: "", is_primary: false }); setContactDialogOpen(true); }}>
                  <Plus className="mr-1.5 h-3 w-3" /> Add Contact
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts added yet.</p>
              ) : contacts.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {c.full_name}
                      {c.is_primary && <Badge variant="secondary" className="ml-2 text-xs">Primary</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{c.designation} · {c.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.invited_at && <Badge variant="outline" className="text-xs">Invited</Badge>}
                    <Button variant="ghost" size="sm" onClick={() => {
                      setEditingContact(c);
                      setContactForm({ full_name: c.full_name, email: c.email, designation: c.designation, is_primary: c.is_primary });
                      setContactDialogOpen(true);
                    }}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteContact(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invitations</CardTitle>
              <CardDescription>Share these links with contacts to let them join</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No invitations sent yet.</p>
              ) : invitations.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.accepted_at ? "Accepted" : new Date(inv.expires_at) < new Date() ? "Expired" : "Pending"}
                      {" · "}{inv.role?.replace("_", " ")}
                    </p>
                  </div>
                  {!inv.accepted_at && new Date(inv.expires_at) >= new Date() && (
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); copyInviteLink(inv.token); }}>
                      <Copy className="mr-1.5 h-3 w-3" /> Copy Link
                    </Button>
                  )}
                  {inv.accepted_at && <Badge className="bg-green-600 text-xs">Joined</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTS TAB */}
        <TabsContent value="documents" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload KYC/KYB Document</CardTitle>
              <CardDescription>Select document type, choose file, preview, then confirm upload</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Document Type</Label>
                  <Select value={uploadDocType} onValueChange={(v) => { setUploadDocType(v); setAiValidationResult(null); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Label</Label>
                  <Input placeholder="e.g. 2024 Audited Financials" value={uploadDocLabel}
                    onChange={(e) => setUploadDocLabel(e.target.value)} />
                </div>
              </div>

              {/* File selection */}
              <div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls" />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  {selectedFile ? "Change File" : "Choose File"}
                </Button>
              </div>

              {/* File Preview */}
              {selectedFile && (
                <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB · {selectedFile.type || "unknown type"}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetUploadForm}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Image preview */}
                  {filePreviewUrl && (
                    <div className="rounded border overflow-hidden max-h-48">
                      <img src={filePreviewUrl} alt="Preview" className="w-full h-auto max-h-48 object-contain" />
                    </div>
                  )}

                  {/* PDF indicator */}
                  {selectedFile.type === "application/pdf" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" />
                      PDF document — will be stored for review
                    </div>
                  )}

                  {/* AI Validation Result */}
                  {aiValidationResult && (
                    <div className={`rounded-lg border p-3 text-sm ${aiValidationResult.matches ? "border-green-200 bg-green-50 dark:bg-green-950/20" : "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {aiValidationResult.matches ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                        <span className="font-medium">
                          {aiValidationResult.matches ? "Document type looks correct" : "Possible document type mismatch"}
                        </span>
                        <Badge variant="outline" className="text-xs ml-auto">{aiValidationResult.confidence}% confidence</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{aiValidationResult.reason}</p>
                      {!aiValidationResult.matches && aiValidationResult.suggested_label && (
                        <p className="text-xs mt-1">Suggested type: <strong>{aiValidationResult.suggested_label}</strong></p>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={runAiValidation} disabled={aiValidating}>
                      {aiValidating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Brain className="mr-2 h-3.5 w-3.5" />}
                      {aiValidating ? "Validating..." : "AI Validate"}
                    </Button>
                    <Button size="sm" onClick={() => confirmUpload()} disabled={uploading}>
                      {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                      {uploading ? "Uploading..." : "Confirm Upload"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submitted Documents</CardTitle>
              <CardDescription>{activeDocs.length} document(s) — {activeDocs.filter((d: any) => d.status === "approved").length} approved</CardDescription>
            </CardHeader>
            <CardContent>
              {activeDocs.filter((d: any) => d.status !== "rejected").length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {activeDocs.filter((d: any) => d.status !== "rejected").map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        {docStatusIcon(doc.status)}
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.document_label}</p>
                          <p className="text-xs text-muted-foreground">{doc.file_name} · {doc.document_type.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={doc.status === "approved" ? "default" : "secondary"} className="text-xs capitalize">
                          {doc.status}
                        </Badge>
                        {doc.status === "pending" && (
                          <Button variant="outline" size="sm" onClick={() => { setReviewDoc(doc); setReviewNotes(""); setReviewOpen(true); }}>
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rejected Documents */}
          {rejectedDocs.length > 0 && (
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setShowRejected(!showRejected)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-destructive">Rejected Documents ({rejectedDocs.length})</CardTitle>
                  <Badge variant="outline" className="text-xs">{showRejected ? "Hide" : "Show"}</Badge>
                </div>
              </CardHeader>
              {showRejected && (
                <CardContent>
                  <div className="space-y-2">
                    {rejectedDocs.map((doc: any) => (
                      <div key={doc.id} className="flex items-center justify-between rounded-lg border border-destructive/20 p-3">
                        <div className="flex items-center gap-3">
                          <XCircle className="h-4 w-4 text-destructive" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{doc.document_label}</p>
                            <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                            {doc.review_notes && (
                              <p className="text-xs text-destructive mt-1">Reason: {doc.review_notes}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => { setReviewDoc(doc); setReviewNotes(""); setReviewOpen(true); }}>
                            <RotateCcw className="mr-1.5 h-3 w-3" /> Re-review
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setDeleteDocId(doc.id); setDeleteConfirmOpen(true); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </TabsContent>

        {/* APPROVAL TAB */}
        <TabsContent value="approval" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Onboarding Approval</CardTitle>
              <CardDescription>Review all documents and approve the originator to go live</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Checklist linked to items */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Document Checklist</h4>
                {activeDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                ) : (
                  activeDocs.filter((d: any) => d.status !== "rejected").map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {docStatusIcon(doc.status)}
                        <button
                          className="text-left hover:underline text-foreground"
                          onClick={() => setActiveTab("documents")}
                        >
                          {doc.document_label}
                        </button>
                      </div>
                      <Badge variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">
                        {doc.status}
                      </Badge>
                    </div>
                  ))
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Current Status</span>
                  <Badge variant="outline" className="capitalize">{org.onboarding_status?.replace(/_/g, " ")}</Badge>
                </div>
              </div>

              {!allDocsApproved && activeDocs.length > 0 && (
                <p className="text-sm text-yellow-600">⚠ All documents must be approved before the organization can be activated.</p>
              )}
              {activeDocs.length === 0 && (
                <p className="text-sm text-muted-foreground">No documents have been uploaded yet. Upload KYC/KYB documents first.</p>
              )}

              <div className="flex flex-wrap gap-2">
                {org.onboarding_status === "pending_documents" && activeDocs.length > 0 && (
                  <Button variant="outline" onClick={() => handleOrgStatusChange("documents_submitted")} disabled={statusUpdating}>
                    Mark as Documents Submitted
                  </Button>
                )}
                {(org.onboarding_status === "documents_submitted") && (
                  <Button variant="outline" onClick={() => handleOrgStatusChange("under_review")} disabled={statusUpdating}>
                    Start Review
                  </Button>
                )}
                {canApprove && (
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleOrgStatusChange("approved")} disabled={statusUpdating}>
                    {statusUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve & Activate
                  </Button>
                )}
                {org.onboarding_status !== "rejected" && org.onboarding_status !== "on_hold" && (
                  <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => handleOrgStatusChange("on_hold")} disabled={statusUpdating}>
                    <PauseCircle className="mr-2 h-4 w-4" /> Put On Hold
                  </Button>
                )}
                {isOnHold && (
                  <Button variant="outline" onClick={() => handleOrgStatusChange("under_review")} disabled={statusUpdating}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Resume Review
                  </Button>
                )}
                {org.onboarding_status !== "rejected" && org.onboarding_status !== "approved" && !isOnHold && (
                  <Button variant="destructive" onClick={() => handleOrgStatusChange("rejected")} disabled={statusUpdating}>
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                )}
                {(org.onboarding_status === "approved" || org.onboarding_status === "rejected") && (
                  <Button variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => handleOrgStatusChange("on_hold")} disabled={statusUpdating}>
                    <PauseCircle className="mr-2 h-4 w-4" /> Put On Hold
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
            <DialogDescription>{reviewDoc?.document_label} — {reviewDoc?.file_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {reviewDoc?.review_notes && reviewDoc?.status === "rejected" && (
              <div className="rounded-lg border border-destructive/20 p-3 bg-destructive/5">
                <p className="text-xs font-medium text-destructive mb-1">Previous rejection reason:</p>
                <p className="text-sm text-muted-foreground">{reviewDoc.review_notes}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Review Notes (optional)</Label>
              <Textarea placeholder="Add any notes about this document..." value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={() => handleReview("rejected")} disabled={statusUpdating}>
              <XCircle className="mr-2 h-4 w-4" /> Reject
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => handleReview("approved")} disabled={statusUpdating}>
              {statusUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>This will remove the document from the active list. The audit trail will be preserved for compliance.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteDoc} disabled={statusUpdating}>
              {statusUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Mismatch Dialog */}
      <Dialog open={showMismatchDialog} onOpenChange={setShowMismatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Document Type Mismatch
            </DialogTitle>
            <DialogDescription>
              AI analysis suggests this file may not match the selected document type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">{aiValidationResult?.reason}</p>
            {aiValidationResult?.suggested_label && (
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-sm"><strong>Suggested type:</strong> {aiValidationResult.suggested_label}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {aiValidationResult?.suggested_type && (
              <Button variant="outline" onClick={() => {
                setUploadDocType(aiValidationResult.suggested_type);
                const suggested = DOC_TYPES.find(d => d.value === aiValidationResult.suggested_type);
                if (suggested) setUploadDocLabel(suggested.label);
                setShowMismatchDialog(false);
              }}>
                Use Suggested Type
              </Button>
            )}
            <Button onClick={() => confirmUpload()}>
              Upload As-Is
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
