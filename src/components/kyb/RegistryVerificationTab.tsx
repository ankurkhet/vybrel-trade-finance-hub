import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Building2, Users,
  FileText, AlertOctagon, MapPin, ExternalLink, ChevronDown, Sparkles,
  ShieldCheck, ShieldAlert, Info, HelpCircle
} from "lucide-react";
import { toast } from "sonner";

interface RegistryVerificationTabProps {
  borrowerId: string;
  organizationId: string;
  borrowerData?: any;
}

function formatLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Verdict badge */
function VerdictBadge({ verdict }: { verdict: string }) {
  switch (verdict) {
    case "verified":
      return <Badge className="gap-1 bg-emerald-600 text-white text-xs"><CheckCircle2 className="h-3 w-3" />Verified</Badge>;
    case "partial_match":
      return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-400 text-xs"><AlertTriangle className="h-3 w-3" />Partial Match</Badge>;
    case "discrepancy_found":
      return <Badge variant="destructive" className="gap-1 text-xs"><XCircle className="h-3 w-3" />Discrepancy Found</Badge>;
    case "not_found":
      return <Badge variant="outline" className="gap-1 text-muted-foreground text-xs"><HelpCircle className="h-3 w-3" />Not Found</Badge>;
    case "manual_review_required":
      return <Badge className="gap-1 bg-amber-500 text-white text-xs"><ShieldAlert className="h-3 w-3" />Manual Review Required</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs capitalize">{verdict?.replace(/_/g, " ")}</Badge>;
  }
}

/** Severity colour */
function flagSeverityClass(severity: string): string {
  switch (severity) {
    case "high": return "border-destructive/30 bg-destructive/5 text-destructive";
    case "medium": return "border-amber-300/50 bg-amber-50/60 text-amber-800 dark:text-amber-400";
    case "low": return "border-blue-200/50 bg-blue-50/40 text-blue-700 dark:text-blue-400";
    default: return "border-border bg-muted/30 text-muted-foreground";
  }
}

function typeIcon(type: string) {
  switch (type) {
    case "company_profile": return <Building2 className="h-4 w-4" />;
    case "directors": return <Users className="h-4 w-4" />;
    case "filings": case "filing_history": return <FileText className="h-4 w-4" />;
    case "insolvency": case "charges": return <AlertOctagon className="h-4 w-4" />;
    case "address_verification": return <MapPin className="h-4 w-4" />;
    default: return <FileText className="h-4 w-4" />;
  }
}

function getSectionLabel(type: string): string {
  switch (type) {
    case "company_profile": return "Company Registration Check";
    case "directors": return "Directors & Officers Check";
    case "filings": case "filing_history": return "Filing History Check";
    case "insolvency": return "Insolvency Check";
    case "charges": return "Charges & Mortgages Check";
    case "address_verification": return "Address Verification";
    default: return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** Flatten a nested object into label-value pairs for the raw data collapsible */
function flattenData(obj: any, prefix = ""): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  if (!obj || typeof obj !== "object") return rows;
  for (const [key, val] of Object.entries(obj)) {
    const label = prefix ? `${prefix} › ${formatLabel(key)}` : formatLabel(key);
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      if (typeof val[0] === "object") {
        val.forEach((item, i) => rows.push(...flattenData(item, `${label} [${i + 1}]`)));
      } else {
        rows.push({ label, value: val.join(", ") });
      }
    } else if (typeof val === "object") {
      rows.push(...flattenData(val, label));
    } else {
      rows.push({ label, value: String(val) });
    }
  }
  return rows;
}

/** AI Findings Card — the main display surface */
function AiFindingsCard({ item, type }: { item: any; type: string }) {
  const [rawOpen, setRawOpen] = useState(false);
  const ai = item.ai_summary as any;
  const dataRows = flattenData(item.data);
  const hasDiscrepancies = item.match_analysis?.differences?.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] font-normal gap-1">
                <ExternalLink className="h-2.5 w-2.5" />
                {item.registry_name || getSectionLabel(type)}
              </Badge>
              <CardTitle className="text-sm">{getSectionLabel(type)}</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Fetched {new Date(item.fetched_at).toLocaleString()}
              {ai && (
                <span className="ml-2 inline-flex items-center gap-1 text-primary">
                  <Sparkles className="h-3 w-3" /> AI-interpreted
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {ai?.verdict && <VerdictBadge verdict={ai.verdict} />}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── AI Summary ───────────────────────────────────────── */}
        {ai?.summary && (
          <div className="rounded-lg border bg-primary/5 border-primary/10 p-4 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground leading-relaxed">{ai.summary}</p>
          </div>
        )}

        {/* ── Key Facts ────────────────────────────────────────── */}
        {ai?.key_facts && ai.key_facts.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Key Registry Facts
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ai.key_facts.map((fact: any, i: number) => (
                <div key={i} className="flex flex-col rounded-md border border-border bg-muted/20 px-3 py-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{fact.label}</span>
                  <span className="text-sm font-medium text-foreground mt-0.5">{fact.value || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Flags & Discrepancies ────────────────────────────── */}
        {ai?.flags && ai.flags.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Flags & Discrepancies
            </p>
            <div className="space-y-2">
              {ai.flags.map((flag: any, i: number) => (
                <div key={i} className={`rounded-md border px-3 py-2.5 flex items-start gap-2 text-sm ${flagSeverityClass(flag.severity)}`}>
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div>
                    {flag.field && (
                      <span className="text-[10px] font-semibold uppercase opacity-70 block">{formatLabel(flag.field)}</span>
                    )}
                    <span>{flag.message}</span>
                  </div>
                  <Badge
                    variant={flag.severity === "high" ? "destructive" : "outline"}
                    className="ml-auto text-[9px] uppercase shrink-0"
                  >
                    {flag.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Legacy match discrepancies (if no AI summary) ────── */}
        {!ai && hasDiscrepancies && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm font-semibold text-foreground">Discrepancies Found</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[140px]">Field</TableHead>
                  <TableHead className="text-xs">Your Data</TableHead>
                  <TableHead className="text-xs">Registry Data</TableHead>
                  <TableHead className="text-xs w-[90px]">Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.match_analysis.differences.map((diff: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{formatLabel(diff.field)}</TableCell>
                    <TableCell className="text-xs">{diff.provided || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {diff.registry || "—"}
                      {diff.distance_km && (
                        <span className="ml-2 text-destructive font-medium">({diff.distance_km} km apart)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={diff.severity === "high" ? "destructive" : diff.severity === "medium" ? "outline" : "secondary"}
                        className="text-[10px] capitalize"
                      >
                        {diff.severity || "info"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* ── Analyst Recommendation ───────────────────────────── */}
        {ai?.recommendation && (
          <div className="rounded-lg border border-blue-200/50 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-800/30 p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold uppercase text-blue-600 dark:text-blue-400 mb-0.5">Analyst Recommendation</p>
              <p className="text-sm text-foreground">{ai.recommendation}</p>
            </div>
          </div>
        )}

        {/* ── No Data State ─────────────────────────────────────── */}
        {!ai && !hasDiscrepancies && dataRows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No data returned from the registry.</p>
        )}

        {!ai && item.match_analysis?.overall_match === "match" && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-sm text-foreground">All fields match the official registry records.</p>
          </div>
        )}

        {/* ── Raw Data Collapsible ─────────────────────────────── */}
        {dataRows.length > 0 && (
          <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground">
                <span>View raw registry data ({dataRows.length} fields)</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${rawOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="rounded-lg border overflow-hidden mt-2">
                <Table>
                  <TableBody>
                    {dataRows.slice(0, 80).map((row, i) => (
                      <TableRow key={i} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground w-[40%] py-1.5 font-medium">{row.label}</TableCell>
                        <TableCell className="text-xs text-foreground py-1.5 font-mono break-all">{row.value}</TableCell>
                      </TableRow>
                    ))}
                    {dataRows.length > 80 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-2">
                          … {dataRows.length - 80} more fields omitted
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

export function RegistryVerificationTab({ borrowerId, organizationId, borrowerData }: RegistryVerificationTabProps) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => { loadResults(); }, [borrowerId]);

  const loadResults = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("registry_results")
      .select("*")
      .eq("borrower_id", borrowerId)
      .order("fetched_at", { ascending: false });
    setResults(data || []);
    setLoading(false);
  };

  const triggerLookup = async () => {
    if (!borrowerData?.country || !borrowerData?.company_name) {
      toast.error("Company name and country are required for registry lookup");
      return;
    }
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("registry-lookup", {
        body: {
          borrower_id: borrowerId,
          organization_id: organizationId,
          company_name: borrowerData.company_name,
          registration_number: borrowerData.registration_number,
          country_code: borrowerData.country,
        },
      });
      if (error) throw error;
      toast.success("Registry lookup completed — AI is interpreting results");
      await loadResults();
    } catch (err: any) {
      toast.error(err.message || "Registry lookup failed");
    }
    setFetching(false);
  };

  // Group by result_type, take the most recent of each
  const grouped = results.reduce((acc: Record<string, any[]>, r) => {
    if (!acc[r.result_type]) acc[r.result_type] = [];
    acc[r.result_type].push(r);
    return acc;
  }, {});

  // Compute overall verdict summary
  const allAiSummaries = results.map((r) => r.ai_summary).filter(Boolean);
  const overallVerdict = allAiSummaries.length > 0
    ? (allAiSummaries.some((s: any) => s.verdict === "discrepancy_found") ? "discrepancy_found"
      : allAiSummaries.some((s: any) => s.verdict === "manual_review_required") ? "manual_review_required"
      : allAiSummaries.some((s: any) => s.verdict === "partial_match") ? "partial_match"
      : allAiSummaries.every((s: any) => s.verdict === "verified") ? "verified"
      : "partial_match")
    : null;

  const totalFlags = allAiSummaries.reduce((sum: number, s: any) => sum + (s?.flags?.length || 0), 0);
  const highFlags = allAiSummaries.reduce((sum: number, s: any) => sum + (s?.flags?.filter((f: any) => f.severity === "high").length || 0), 0);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Registry Verification</h3>
          <p className="text-sm text-muted-foreground">AI-interpreted data from official company registries</p>
        </div>
        <Button onClick={triggerLookup} disabled={fetching} size="sm">
          {fetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {results.length > 0 ? "Refresh Lookup" : "Run Lookup"}
        </Button>
      </div>

      {results.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              No registry data yet. Click <strong>Run Lookup</strong> to fetch and AI-interpret official company records from active registry APIs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── Overall KYB Verdict Banner ─────────────────────── */}
          {overallVerdict && (
            <Card className={`border-2 ${
              overallVerdict === "verified" ? "border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/20"
              : overallVerdict === "discrepancy_found" ? "border-destructive/40 bg-destructive/5"
              : "border-amber-400/40 bg-amber-50/30 dark:bg-amber-950/20"
            }`}>
              <CardContent className="flex items-center justify-between py-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {overallVerdict === "verified"
                    ? <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    : overallVerdict === "discrepancy_found"
                    ? <ShieldAlert className="h-6 w-6 text-destructive" />
                    : <AlertTriangle className="h-6 w-6 text-amber-500" />}
                  <div>
                    <p className="font-semibold text-foreground text-sm">Overall KYB Verdict</p>
                    <p className="text-xs text-muted-foreground">
                      {allAiSummaries.length} check{allAiSummaries.length !== 1 ? "s" : ""} completed
                      {totalFlags > 0 && ` · ${totalFlags} flag${totalFlags !== 1 ? "s" : ""} found`}
                      {highFlags > 0 && ` · ${highFlags} high severity`}
                    </p>
                  </div>
                </div>
                <VerdictBadge verdict={overallVerdict} />
              </CardContent>
            </Card>
          )}

          {/* ── Per-check Results ─────────────────────────────── */}
          <div className="space-y-4">
            {Object.entries(grouped).map(([type, items]: [string, any[]]) => (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-muted-foreground">{typeIcon(type)}</span>
                  <p className="text-sm font-semibold text-foreground">{getSectionLabel(type)}</p>
                  <Badge variant="secondary" className="text-[10px]">{items.length} result{items.length !== 1 ? "s" : ""}</Badge>
                </div>
                <div className="space-y-3">
                  {(items as any[]).map((item: any) => (
                    <AiFindingsCard key={item.id} item={item} type={type} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
