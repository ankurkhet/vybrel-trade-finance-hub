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
  ChevronDown, ChevronRight, History, Search, Users, Building2, Eye, ShieldCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

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
  const [selectedBorrower, setSelectedBorrower] = useState<string>("");
  const [borrowerDocs, setBorrowerDocs] = useState<BorrowerDoc[]>([]);
  const [borrowerDocsLoading, setBorrowerDocsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Funder docs state
  const [selectedFunder, setSelectedFunder] = useState<string>("");
  const [funderReviewDialog, setFunderReviewDialog] = useState<any>(null);

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

  // Fetch Funders for KYC Audit
  const { data: funders = [], isLoading: fundersLoading, refetch: refetchFunders } = useQuery({
    queryKey: ['org-funders-documents', profile?.organization_id],
    queryFn: async () => {
      const { data: roleRecords } = await supabase.from('user_roles').select('user_id').eq('role', 'funder');
      const funderUserIds = roleRecords?.map((r: any) => r.user_id) || [];
      const { data: profiles } = await supabase.from('profiles').select('*').eq('organization_id', profile?.organization_id).in('id', funderUserIds.length ? funderUserIds : ['00000000-0000-0000-0000-000000000000']);
      const validFunderIds = profiles?.map((p: any) => p.id) || [];
      const funderKycQuery = supabase.from('funder_kyc').select('*');
      const funderKycFiltered = validFunderIds.length
        ? funderKycQuery.in('funder_user_id', validFunderIds)
        : funderKycQuery.in('funder_user_id', ['00000000-0000-0000-0000-000000000000']);
      const { data: funderDocs } = await funderKycFiltered.order('created_at', { ascending: false });
      return (profiles || []).map(f => ({ ...f, documents: ((funderDocs as any[]) || []).filter(d => d.funder_user_id === f.id) }));
    },
    enabled: !!profile?.organization_id && activeTab === "funders"
  });

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
      reviewed_by: profile?.id,
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

  const handleFunderDocReview = async (docId: string, status: string) => {
    const { error } = await supabase.from('funder_kyc').update({ 
      kyc_status: status,
      kyc_reviewed_at: new Date().toISOString(),
      kyc_reviewed_by: user?.id
    } as any).eq('id', docId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Document ${status}`);
      refetchFunders();
    }
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

  // Auto-select first borrower if none selected
  useEffect(() => {
    if (!selectedBorrower && borrowers.length > 0) {
      setSelectedBorrower(borrowers[0].id);
    }
  }, [borrowers, selectedBorrower]);

  // Filter borrower docs — only show selected borrower
  const filteredBorrowerDocs = borrowerDocs.filter(d => {
    if (!selectedBorrower) return false;
    const matchBorrower = d.borrower_id === selectedBorrower;
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
              <Users className="h-3.5 w-3.5" /> Borrower Docs
            </TabsTrigger>
            <TabsTrigger value="funders" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Funder Audit
            </TabsTrigger>
            <TabsTrigger value="organization" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Org Profile
            </TabsTrigger>
          </TabsList>

          {/* === Borrower Documents Tab === */}
          <TabsContent value="borrowers" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex gap-3 items-center flex-wrap">
              <Select value={selectedBorrower} onValueChange={setSelectedBorrower}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select a borrower" />
                </SelectTrigger>
                <SelectContent>
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
                            <TableCell>
                              <button
                                className="text-sm text-primary underline hover:text-primary/80 text-left"
                                onClick={async () => {
                                  const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 300);
                                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                  else toast.error("Could not open file");
                                }}
                              >
                                {doc.file_name}
                              </button>
                            </TableCell>
                            <TableCell className="text-xs">v{doc.version}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(doc.status)} className="capitalize text-xs">{doc.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                                  const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 300);
                                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {doc.status === "pending" && (
                                  <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                                    setDocReviewDialog(doc);
                                    setDocAction("approved");
                                    setDocRejectionReason("");
                                  }}>
                                    Review
                                  </Button>
                                )}
                              </div>
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

          {/* === Funder Documents Tab === */}
          <TabsContent value="funders" className="mt-4 space-y-4">
            <div className="flex justify-between items-center bg-muted/30 p-4 rounded-lg border border-dashed">
                <div className="flex gap-2 items-center text-primary">
                    <ShieldCheck className="h-5 w-5" />
                    <div>
                        <h3 className="text-sm font-bold">Funder KYC Audit Desk</h3>
                        <p className="text-[10px] text-muted-foreground">Verify institutional credentials of connecting Lenders.</p>
                    </div>
                </div>
                <Select value={selectedFunder} onValueChange={setSelectedFunder}>
                    <SelectTrigger className="w-[300px] h-9"><SelectValue placeholder="Filter by Funder" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Participating Funders</SelectItem>
                        {funders.map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.full_name || f.email}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>

            {fundersLoading ? (
               <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
                funders.filter((f: any) => selectedFunder === "all" || !selectedFunder || f.id === selectedFunder).map((f: any) => (
                    <Card key={f.id} className="overflow-hidden border-l-4 border-l-primary/50">
                        <CardHeader className="py-4 bg-muted/20">
                            <CardTitle className="text-sm flex items-center justify-between">
                                <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {f.full_name || f.email}</span>
                                <Badge variant="outline" className="text-[10px] uppercase font-bold">{f.documents.length} KYC Packets</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow>
                                        <TableHead className="text-[10px] py-1">Doc Type</TableHead>
                                        <TableHead className="text-[10px] py-1">Filename</TableHead>
                                        <TableHead className="text-[10px] py-1">Status</TableHead>
                                        <TableHead className="text-right text-[10px] py-1">Decision</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {f.documents.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-xs text-center py-6 text-muted-foreground">No KYC documents submitted yet.</TableCell></TableRow>
                                    ) : (
                                        f.documents.map((doc: any) => (
                                            <TableRow key={doc.id}>
                                                <TableCell className="text-xs font-semibold py-3">{doc.kyc_type.replace(/_/g, ' ')}</TableCell>
                                                <TableCell><button className="text-xs text-primary underline" onClick={() => window.open(doc.file_path, '_blank')}>{doc.file_name || 'View File'}</button></TableCell>
                                                <TableCell>
                                                    <Badge className="text-[10px] capitalize" variant={doc.kyc_status === 'approved' ? 'default' : doc.kyc_status === 'rejected' ? 'destructive' : 'secondary'}>
                                                        {doc.kyc_status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700" onClick={() => handleFunderDocReview(doc.id, 'approved')}>
                                                            <CheckCircle2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleFunderDocReview(doc.id, 'rejected')}>
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
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
                                  <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                                    onClick={async () => {
                                      const { data } = await supabase.storage.from("org-documents").createSignedUrl(doc.file_path, 300);
                                      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                                      else toast.error("Could not open file");
                                    }}>
                                    <div className="flex items-center gap-3">
                                      {statusIcon(doc.status)}
                                      <div>
                                        <p className="text-sm font-medium text-primary underline">{doc.file_name}</p>
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
