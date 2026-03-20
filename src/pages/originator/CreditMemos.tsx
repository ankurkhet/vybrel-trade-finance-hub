import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "outline" },
  ai_generated: { label: "AI Generated", variant: "secondary" },
  under_review: { label: "Under Review", variant: "default" },
  submitted_to_committee: { label: "With Committee", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const riskConfig: Record<string, { variant: "default" | "secondary" | "outline" | "destructive" }> = {
  low: { variant: "default" },
  moderate: { variant: "secondary" },
  elevated: { variant: "outline" },
  high: { variant: "destructive" },
  critical: { variant: "destructive" },
};

export default function CreditMemos() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: memos = [], isLoading } = useQuery({
    queryKey: ["credit-memos", profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_memos")
        .select("*, borrowers(company_name)")
        .eq("organization_id", profile!.organization_id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  const filtered = memos.filter((m: any) => {
    const matchSearch =
      !search ||
      (m.borrowers?.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.memo_number || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: memos.length,
    pending: memos.filter((m: any) => ["draft", "ai_generated", "under_review"].includes(m.status)).length,
    withCommittee: memos.filter((m: any) => m.status === "submitted_to_committee").length,
    approved: memos.filter((m: any) => m.status === "approved").length,
    rejected: memos.filter((m: any) => m.status === "rejected").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Credit Memos</h1>
          <p className="text-muted-foreground">
            Review AI-generated credit analyses, edit findings, and share finalized memos with the Credit Committee.
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-5">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Memos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-5 w-5 text-[hsl(var(--chart-4))]" />
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Send className="h-5 w-5 text-[hsl(var(--chart-3))]" />
              <div>
                <p className="text-2xl font-bold">{stats.withCommittee}</p>
                <p className="text-xs text-muted-foreground">With Committee</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-5 w-5 text-[hsl(var(--chart-2))]" />
              <div>
                <p className="text-2xl font-bold">{stats.approved}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats.rejected}</p>
                <p className="text-xs text-muted-foreground">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by borrower or memo number..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ai_generated">AI Generated</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="approved">Finalized</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                {memos.length === 0
                  ? "No credit memos yet. Generate one from a borrower's profile."
                  : "No memos match your filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Memo #</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Recommended Limit</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((memo: any) => {
                    const sc = statusConfig[memo.status] || statusConfig.draft;
                    const rc = memo.risk_rating ? riskConfig[memo.risk_rating] : null;
                    return (
                      <TableRow key={memo.id} className="cursor-pointer" onClick={() => navigate(`/originator/credit-memos/${memo.id}`)}>
                        <TableCell className="font-mono text-xs">{memo.memo_number || "—"}</TableCell>
                        <TableCell className="font-medium">{memo.borrowers?.company_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={sc.variant} className="capitalize">{sc.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {rc ? (
                            <Badge variant={rc.variant} className="capitalize">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {memo.risk_rating}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {memo.recommended_limit
                            ? `$${Number(memo.recommended_limit).toLocaleString()}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(memo.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">Review</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
