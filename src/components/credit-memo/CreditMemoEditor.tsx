import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Save, Send, FileText, AlertTriangle, CheckCircle2, RotateCcw, Clock } from "lucide-react";
import { toast } from "sonner";
import { generateCreditMemo } from "@/lib/ai-services";
import { CurrencyInput, formatCurrency, type CurrencyCode } from "@/components/ui/currency-input";

interface CreditMemoEditorProps {
  borrowerId: string;
  organizationId: string;
  borrowerName: string;
}

export function CreditMemoEditor({ borrowerId, organizationId, borrowerName }: CreditMemoEditorProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [memos, setMemos] = useState<any[]>([]);
  const [activeMemo, setActiveMemo] = useState<any>(null);
  const [editedText, setEditedText] = useState("");
  const [proposedLimit, setProposedLimit] = useState("");
  const [proposedCurrency, setProposedCurrency] = useState<CurrencyCode>("GBP");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [docsNotVerified, setDocsNotVerified] = useState(false);

  useEffect(() => {
    fetchMemos();
    checkDocsVerified();
  }, [borrowerId]);

  const checkDocsVerified = async () => {
    // Check if all KYC/KYB documents are uploaded and verified
    const { data: docs } = await supabase
      .from("documents")
      .select("id, status")
      .eq("borrower_id", borrowerId)
      .eq("is_deleted", false);
    if (!docs || docs.length === 0) {
      setDocsNotVerified(true);
      return;
    }
    const allApproved = docs.every((d: any) => d.status === "approved");
    setDocsNotVerified(!allApproved);
  };

  const fetchMemos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("credit_memos")
      .select("*")
      .eq("borrower_id", borrowerId)
      .order("created_at", { ascending: false });
    setMemos(data || []);
    if (data && data.length > 0) {
      setActiveMemo(data[0]);
      setEditedText(data[0].analyst_edits || data[0].ai_draft || "");
      setProposedLimit(data[0].recommended_limit?.toString() || "");
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateCreditMemo({
        borrowerId,
        organizationId,
        transactionType: "trade_finance",
      });
      await fetchMemos();
      toast.success("Credit memo generated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate credit memo");
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!activeMemo) return;
    setSaving(true);
    const { error } = await supabase
      .from("credit_memos")
      .update({
        analyst_edits: editedText,
        recommended_limit: proposedLimit ? Number(proposedLimit) : null,
        status: "under_review",
      })
      .eq("id", activeMemo.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Changes saved");
      await fetchMemos();
    }
    setSaving(false);
  };

  const handleSubmitToCommittee = async () => {
    if (!activeMemo) return;
    if (!proposedLimit || Number(proposedLimit) <= 0) {
      toast.error("Please enter a proposed credit limit before submitting to the committee.");
      return;
    }
    setSaving(true);
    try {
      // Update memo status
      const { error: memoError } = await supabase
        .from("credit_memos")
        .update({
          analyst_edits: editedText,
          recommended_limit: Number(proposedLimit),
          final_memo: editedText,
          status: "submitted_to_committee",
          reviewed_by: profile?.user_id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", activeMemo.id);
      if (memoError) throw memoError;

      // Auto-create a credit committee application
      const appNum = `CC-${Date.now().toString(36).toUpperCase()}`;
      const { error: appError } = await supabase
        .from("credit_committee_applications")
        .insert({
          organization_id: organizationId,
          type: "credit_limit",
          borrower_id: borrowerId,
          debtor_name: borrowerName,
          application_number: appNum,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          created_by: profile?.user_id,
          metadata: {
            credit_memo_id: activeMemo.id,
            proposed_limit: Number(proposedLimit),
            risk_rating: activeMemo.risk_rating,
            memo_number: activeMemo.memo_number,
          },
        });
      if (appError) throw appError;

      toast.success("Credit memo submitted to committee for approval");
      await fetchMemos();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit to committee");
    }
    setSaving(false);
  };

  const riskColor = (rating: string) => {
    switch (rating) {
      case "low": return "default";
      case "moderate": return "secondary";
      case "elevated": return "outline";
      case "high": case "critical": return "destructive";
      default: return "outline";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "draft": return "outline";
      case "ai_generated": return "secondary";
      case "under_review": return "default";
      case "approved": return "default";
      case "rejected": return "destructive";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Generate Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Credit Memo</h3>
          <p className="text-sm text-muted-foreground">
            AI-generated credit analysis for {borrowerName}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Block regeneration when submitted to committee or approved */}
          {!activeMemo || !["submitted_to_committee", "approved"].includes(activeMemo?.status) ? (
            <Button onClick={handleGenerate} disabled={generating || docsNotVerified} variant={memos.length > 0 ? "outline" : "default"}>
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : memos.length > 0 ? (
                <RotateCcw className="mr-2 h-4 w-4" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {memos.length > 0 ? "Regenerate" : "Generate Credit Memo"}
            </Button>
          ) : null}
        </div>
      </div>

      {docsNotVerified && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-[hsl(var(--chart-4))]" />
            <p className="text-sm text-muted-foreground">
              All KYC/KYB documents must be uploaded and verified before a credit memo can be generated.
            </p>
          </CardContent>
        </Card>
      )}

      {!activeMemo ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              No credit memo yet. Click "Generate Credit Memo" to create an AI-powered analysis.
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              The AI will analyse filing data from connected registries, financial APIs, and public sources to create a comprehensive credit memo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Memo Status Bar */}
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-4">
                <Badge variant={statusColor(activeMemo.status) as any} className="capitalize">
                  {activeMemo.status?.replace(/_/g, " ")}
                </Badge>
                {activeMemo.risk_rating && (
                  <Badge variant={riskColor(activeMemo.risk_rating) as any} className="capitalize">
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Risk: {activeMemo.risk_rating}
                  </Badge>
                )}
                {activeMemo.memo_number && (
                  <span className="text-xs font-mono text-muted-foreground">{activeMemo.memo_number}</span>
                )}
              </div>
              <div className="flex gap-2">
                {!["approved", "submitted_to_committee"].includes(activeMemo.status) && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                      Save Draft
                    </Button>
                    <Button size="sm" onClick={handleSubmitToCommittee} disabled={saving}>
                      {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
                      Submit to Committee
                    </Button>
                  </>
                )}
                {activeMemo.status === "submitted_to_committee" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 text-[hsl(var(--chart-4))]" />
                    Submitted — awaiting Credit Committee decision
                  </div>
                )}
                {activeMemo.status === "approved" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                    Approved by Credit Committee
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Proposed Credit Limit */}
          {!["approved", "submitted_to_committee"].includes(activeMemo.status) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Proposed Credit Limit</CardTitle>
                <CardDescription>Set the credit limit to recommend to the committee</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Label htmlFor="proposed-limit" className="shrink-0">Amount</Label>
                  <CurrencyInput
                    value={proposedLimit}
                    currency={proposedCurrency}
                    onValueChange={setProposedLimit}
                    onCurrencyChange={setProposedCurrency}
                  />
                </div>
              </CardContent>
            </Card>
          )}
          {["approved", "submitted_to_committee"].includes(activeMemo.status) && activeMemo.recommended_limit && (
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <span className="text-sm text-muted-foreground">Proposed Credit Limit:</span>
                <span className="text-lg font-bold text-foreground">{formatCurrency(Number(activeMemo.recommended_limit), proposedCurrency)}</span>
              </CardContent>
            </Card>
          )}

          {/* Memo Content */}
          <Tabs defaultValue="edit" className="w-full">
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              {activeMemo.ai_draft && activeMemo.analyst_edits && (
                <TabsTrigger value="original">AI Original</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="edit" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  <Textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="min-h-[600px] font-mono text-sm leading-relaxed"
                    placeholder="Credit memo content will appear here after generation..."
                    disabled={["approved", "submitted_to_committee"].includes(activeMemo.status)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <Card>
                <CardContent className="p-8">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    {editedText.split("\n").map((line, i) => {
                      if (line.startsWith("# ")) return <h1 key={i} className="text-2xl font-bold text-foreground mt-6 mb-3">{line.slice(2)}</h1>;
                      if (line.startsWith("## ")) return <h2 key={i} className="text-xl font-semibold text-foreground mt-5 mb-2 border-b border-border pb-1">{line.slice(3)}</h2>;
                      if (line.startsWith("### ")) return <h3 key={i} className="text-lg font-medium text-foreground mt-4 mb-1">{line.slice(4)}</h3>;
                      if (line.startsWith("- ") || line.startsWith("* ")) return <li key={i} className="text-sm text-foreground ml-4">{line.slice(2)}</li>;
                      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold text-foreground">{line.slice(2, -2)}</p>;
                      if (line.trim() === "") return <br key={i} />;
                      return <p key={i} className="text-sm text-foreground leading-relaxed">{line}</p>;
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {activeMemo.ai_draft && activeMemo.analyst_edits && (
              <TabsContent value="original" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Original AI Draft</CardTitle>
                    <CardDescription>The unedited AI-generated version</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="whitespace-pre-wrap font-mono text-sm text-muted-foreground leading-relaxed">
                      {activeMemo.ai_draft}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/* Previous Memos */}
          {memos.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Previous Memos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {memos.slice(1).map((memo) => (
                    <div
                      key={memo.id}
                      className="flex items-center justify-between rounded-md border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setActiveMemo(memo);
                        setEditedText(memo.analyst_edits || memo.ai_draft || "");
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="capitalize text-xs">
                          {memo.status?.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(memo.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {memo.risk_rating && (
                        <Badge variant={riskColor(memo.risk_rating) as any} className="capitalize text-xs">
                          {memo.risk_rating}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
