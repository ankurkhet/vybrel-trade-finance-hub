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
  Loader2, Copy, Send, Eye, Shield
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DOC_TYPES = [
  { value: "certificate_of_incorporation", label: "Certificate of Incorporation" },
  { value: "tax_registration", label: "Tax Registration" },
  { value: "board_resolution", label: "Board Resolution" },
  { value: "kyc_directors", label: "KYC — Directors/Shareholders" },
  { value: "aml_policy", label: "AML/CFT Policy" },
  { value: "financial_statements", label: "Audited Financial Statements" },
  { value: "business_license", label: "Business License" },
  { value: "individual_passport", label: "Individual - Passport" },
  { value: "individual_driving_license", label: "Individual - Driving License" },
  { value: "individual_bank_statement", label: "Individual - Bank Statement" },
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadDocType, setUploadDocType] = useState("certificate_of_incorporation");
  const [uploadDocLabel, setUploadDocLabel] = useState("");

  useEffect(() => { fetchAll(); }, [orgId]);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const filePath = `${orgId}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from("org-documents")
      .upload(filePath, file);

    if (uploadErr) { toast.error(uploadErr.message); setUploading(false); return; }

    const { data: session } = await supabase.auth.getSession();
    const label = uploadDocLabel || DOC_TYPES.find((d) => d.value === uploadDocType)?.label || uploadDocType;

    await supabase.from("org_documents" as any).insert({
      organization_id: orgId,
      document_type: uploadDocType,
      document_label: label,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: session.session?.user?.id || null,
    });

    toast.success(`"${file.name}" uploaded`);
    setUploadDocLabel("");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchAll();
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

  const handleOrgStatusChange = async (newStatus: string) => {
    setStatusUpdating(true);
    const updates: any = { onboarding_status: newStatus };
    if (newStatus === "approved") updates.is_active = true;
    if (newStatus === "rejected") updates.is_active = false;

    await supabase.from("organizations").update(updates).eq("id", orgId);
    toast.success(`Organization status updated to "${newStatus.replace("_", " ")}"`);
    setStatusUpdating(false);
    fetchAll();
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/accept?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invitation link copied to clipboard");
  };

  const docStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "rejected": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!org) return <p className="text-muted-foreground">Organization not found.</p>;

  const allDocsApproved = docs.length > 0 && docs.every((d: any) => d.status === "approved");
  const canApprove = allDocsApproved && org.onboarding_status !== "approved";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{org.name}</h1>
          <p className="text-sm text-muted-foreground">/{org.slug}</p>
        </div>
        <div className="flex items-center gap-2">
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
              <CardTitle className="text-base">Contact Persons</CardTitle>
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
                  {c.invited_at && <Badge variant="outline" className="text-xs">Invited</Badge>}
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
              <CardDescription>Upload on behalf of the originator or have them upload via their portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Document Type</Label>
                  <Select value={uploadDocType} onValueChange={setUploadDocType}>
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
                  <Input placeholder="e.g. 2024 Audited Financials" value={uploadDocLabel}
                    onChange={(e) => setUploadDocLabel(e.target.value)} />
                </div>
              </div>
              <div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload}
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
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        {docStatusIcon(doc.status)}
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.document_label}</p>
                          <p className="text-xs text-muted-foreground">{doc.file_name} · {doc.document_type.replace(/_/g, " ")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">
                          {doc.status}
                        </Badge>
                        {doc.status === "pending" && (
                          <Button variant="outline" size="sm" onClick={() => { setReviewDoc(doc); setReviewOpen(true); }}>
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
        </TabsContent>

        {/* APPROVAL TAB */}
        <TabsContent value="approval" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Onboarding Approval</CardTitle>
              <CardDescription>Review all documents and approve the originator to go live</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Documents Uploaded</span>
                  <span className="text-sm text-foreground">{docs.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Documents Approved</span>
                  <span className="text-sm text-foreground">{docs.filter((d: any) => d.status === "approved").length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Documents Pending</span>
                  <span className="text-sm text-foreground">{docs.filter((d: any) => d.status === "pending").length}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Current Status</span>
                  <Badge variant="outline" className="capitalize">{org.onboarding_status?.replace(/_/g, " ")}</Badge>
                </div>
              </div>

              {!allDocsApproved && docs.length > 0 && (
                <p className="text-sm text-yellow-600">⚠ All documents must be approved before the organization can be activated.</p>
              )}
              {docs.length === 0 && (
                <p className="text-sm text-muted-foreground">No documents have been uploaded yet. Upload KYC/KYB documents first.</p>
              )}

              <div className="flex gap-2">
                {org.onboarding_status === "pending_documents" && docs.length > 0 && (
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
                {org.onboarding_status !== "rejected" && org.onboarding_status !== "approved" && (
                  <Button variant="destructive" onClick={() => handleOrgStatusChange("rejected")} disabled={statusUpdating}>
                    <XCircle className="mr-2 h-4 w-4" /> Reject
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
    </div>
  );
}
