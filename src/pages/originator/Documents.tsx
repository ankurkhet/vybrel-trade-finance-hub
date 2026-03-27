import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Upload, Loader2, CheckCircle2, XCircle, Clock, FileText, AlertCircle,
  ChevronDown, ChevronRight, History, Search, Users, Building2, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const ORG_DOC_TYPES = [
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

interface BorrowerDoc {
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
  borrower_id: string | null;
  created_at: string;
}

export default function OriginatorDocuments() {
  const { profile, user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("borrowers");

  // Org docs state
  const [orgDocs, setOrgDocs] = useState<OrgDoc[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(ORG_DOC_TYPES.map(d => d.value)));

  // Borrower docs state
  const [borrowers, setBorrowers] = useState<any[]>([]);
  const [selectedBorrower, setSelectedBorrower] = useState<string>("all");
  const [borrowerDocs, setBorrowerDocs] = useState<BorrowerDoc[]>([]);
  const [borrowerDocsLoading, setBorrowerDocsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Document review dialog
  const [docReviewDialog, setDocReviewDialog] = useState<BorrowerDoc | null>(null);
  const [docAction, setDocAction] = useState<"approved" | "rejected">("approved");
  const [docRejectionReason, setDocRejectionReason] = useState("");

  useEffect(() => {
    if (profile?.organization_id) {
      fetchOrgData();
      fetchBorrowerDocs();
    } else {
      setOrgLoading(false);
      setBorrowerDocsLoading(false);
    }
  }, [profile]);

  const fetchOrgData = async () => {
    const [orgRes, docsRes] = await Promise.all([
      supabase.from("organizations").select("*").eq("id", profile!.organization_id!).single(),
      supabase.from("org_documents").select("*")
        .eq("organization_id", profile!.organization_id!)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
    ]);
    if (orgRes.data) setOrg(orgRes.data);
    if (docsRes.data) setOrgDocs(docsRes.data as OrgDoc[]);
    setOrgLoading(false);
  };

  const fetchBorrowerDocs = async () => {
    setBorrowerDocsLoading(true);
    const [{ data: brs }, { data: docs }] = await Promise.all([
      supabase.from("borrowers").select("id, company_name")
        .eq("organization_id", profile!.organization_id!)
        .order("company_name"),
      supabase.from("documents").select("*")
        .eq("organization_id", profile!.organization_id!)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false }),
    ]);
    setBorrowers(brs || []);
    setBorrowerDocs((docs || []) as BorrowerDoc[]);
    setBorrowerDocsLoading(false);
  };

  const handleOrgUpload = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.organization_id) return;
    setUploading(docType);
    const filePath = `${profile.organization_id}/${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("org-documents").upload(filePath, file);
    if (uploadErr) { toast.error(uploadErr.message); setUploading(null); return; }

    const existingDocs = orgDocs.filter(d => d.document_type === docType);
    const maxVersion = existingDocs.length > 0 ? Math.max(...existingDocs.map(d => d.version)) : 0;
    const label = notes[docType] || ORG_DOC_TYPES.find(d => d.value === docType)?.label || docType;

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
    fetchOrgData();
  };

  const handleDocReview = async () => {
    if (!docReviewDialog) return;
    const updates: any = {
      status: docAction,
      reviewed_by: profile?.user_id,
      reviewed_at: new Date().toISOString(),
    };
    if (docAction === "rejected") updates.rejection_reason = docRejectionReason;
    const { error } = await supabase.from("documents").update(updates).eq("id", docReviewDialog.id);
    if (error) toast.error(error.message);
    else toast.success(`Document ${docAction}`);
    setDocReviewDialog(null);
    setDocRejectionReason("");
    fetchBorrowerDocs();
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

  // Filter borrower docs
  const filteredBorrowerDocs = borrowerDocs.filter(d => {
    const matchBorrower = selectedBorrower === "all" || d.borrower_id === selectedBorrower;
    const matchSearch = !searchQuery || d.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.document_type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchBorrower && matchSearch;
  });

  // Group by borrower for display
  const docsByBorrower = new Map<string, BorrowerDoc[]>();
  filteredBorrowerDocs.forEach(d => {
    const key = d.borrower_id || "unknown";
    if (!docsByBorrower.has(key)) docsByBorrower.set(key, []);
    docsByBorrower.get(key)!.push(d);
  });

  const getBorrowerName = (id: string) =>
    borrowers.find(b => b.id === id)?.company_name || "Unknown Borrower";

  if (!profile?.organization_id) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-foreground">No organization assigned</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">KYC/KYB Documents</h1>
          <p className="text-sm text-muted-foreground">Manage organization and borrower compliance documents</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="borrowers" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Borrower Documents
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Organization Documents
            </TabsTrigger>
          </TabsList>

          {/* === Borrower Documents Tab === */}
          <TabsContent value="borrowers" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex gap-3 items-center flex-wrap">
              <Select value={selectedBorrower} onValueChange={setSelectedBorrower}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Filter by borrower" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Borrowers</SelectItem>
                  {borrowers.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search documents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <Badge variant="secondary" className="text-xs">
                {filteredBorrowerDocs.length} document{filteredBorrowerDocs.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            {borrowerDocsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filteredBorrowerDocs.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center py-12">
                  <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {selectedBorrower !== "all"
                      ? "No documents found for this borrower"
                      : "No borrower documents uploaded yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              Array.from(docsByBorrower.entries()).map(([borrowerId, docs]) => (
                <Card key={borrowerId}>
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-primary" />
                      {getBorrowerName(borrowerId)}
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        {docs.length} document{docs.length !== 1 ? "s" : ""}
                      </Badge>
                      <Badge className={`text-[10px] ${docs.every(d => d.status === "approved") ? "bg-green-600" : docs.some(d => d.status === "rejected") ? "" : ""}`}
                        variant={docs.every(d => d.status === "approved") ? "default" : docs.some(d => d.status === "rejected") ? "destructive" : "secondary"}>
                        {docs.every(d => d.status === "approved") ? "All Approved" :
                         docs.some(d => d.status === "rejected") ? "Action Required" :
                         docs.some(d => d.status === "pending") ? "Pending Review" : "Mixed"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>File</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Uploaded</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {docs.map(doc => (
                          <TableRow key={doc.id}>
                            <TableCell className="capitalize text-xs">{doc.document_type.replace(/_/g, " ")}</TableCell>
                            <TableCell className="text-sm">{doc.file_name}</TableCell>
                            <TableCell className="text-xs">v{doc.version}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(doc.status)} className="capitalize text-xs">{doc.status}</Badge>
                            </TableCell>
                            <TableCell>
                              {doc.status === "pending" && (
                                <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                                  setDocReviewDialog(doc);
                                  setDocAction("approved");
                                  setDocRejectionReason("");
                                }}>
                                  Review
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* === Organization Documents Tab === */}
          <TabsContent value="organization" className="mt-4 space-y-4">
            {org && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{org.onboarding_status?.replace(/_/g, " ")}</Badge>
                {org.is_active && <Badge className="bg-green-600">Active</Badge>}
              </div>
            )}

            {orgLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-4">
                {ORG_DOC_TYPES.map((docType) => {
                  const typeDocs = orgDocs.filter(d => d.document_type === docType.value);
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
                            {latestDoc?.status === "rejected" && latestDoc.review_notes && (
                              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-destructive">Document Rejected</p>
                                    <p className="text-xs text-muted-foreground mt-1">{latestDoc.review_notes}</p>
                                  </div>
                                </div>
                              </div>
                            )}
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
                                  type="file"
                                  className="hidden"
                                  id={`org-upload-${docType.value}`}
                                  onChange={(e) => handleOrgUpload(docType.value, e)}
                                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                />
                                <Button variant="outline" size="sm"
                                  onClick={() => document.getElementById(`org-upload-${docType.value}`)?.click()}
                                  disabled={uploading === docType.value}>
                                  {uploading === docType.value ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                                  Upload
                                </Button>
                              </div>
                            </div>
                            {typeDocs.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-xs font-medium text-muted-foreground">Upload History</span>
                                </div>
                                {typeDocs.map(doc => (
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
                                    <Badge variant={statusBadgeVariant(doc.status)} className="text-xs capitalize">{doc.status}</Badge>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Document Review Dialog */}
      <Dialog open={!!docReviewDialog} onOpenChange={() => setDocReviewDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Document</DialogTitle></DialogHeader>
          {docReviewDialog && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Type</span><p className="font-medium text-sm capitalize">{docReviewDialog.document_type.replace(/_/g, " ")}</p></div>
                <div><span className="text-muted-foreground text-xs">File</span><p className="font-medium text-sm">{docReviewDialog.file_name}</p></div>
                <div><span className="text-muted-foreground text-xs">Borrower</span><p className="font-medium text-sm">{getBorrowerName(docReviewDialog.borrower_id || "")}</p></div>
              </div>
              <div className="space-y-2">
                <Label>Decision</Label>
                <Select value={docAction} onValueChange={(v) => setDocAction(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {docAction === "rejected" && (
                <div className="space-y-1">
                  <Label className="text-xs">Rejection Reason</Label>
                  <Textarea value={docRejectionReason} onChange={(e) => setDocRejectionReason(e.target.value)} placeholder="Explain why this document is rejected..." />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocReviewDialog(null)}>Cancel</Button>
            <Button onClick={handleDocReview} variant={docAction === "rejected" ? "destructive" : "default"}>
              {docAction === "approved" ? "Approve Document" : "Reject Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
