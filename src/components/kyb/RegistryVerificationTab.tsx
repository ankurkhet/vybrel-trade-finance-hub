import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Building2, Users, FileText, AlertOctagon, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface RegistryVerificationTabProps {
  borrowerId: string;
  organizationId: string;
  borrowerData?: any;
}

// Map result_type to a human-readable provider and section label
function getProviderInfo(resultType: string, source?: string): { provider: string; section: string } {
  const src = source?.toLowerCase() || "";

  if (src.includes("companies_house") || src.includes("companies house")) {
    return { provider: "Companies House", section: getSectionLabel(resultType) };
  }
  if (src.includes("creditsafe")) {
    return { provider: "Creditsafe", section: getSectionLabel(resultType) };
  }
  if (src.includes("open_bris") || src.includes("openbris")) {
    return { provider: "Open BRIS (EU)", section: getSectionLabel(resultType) };
  }
  if (src.includes("ckan")) {
    return { provider: "CKAN Registry", section: getSectionLabel(resultType) };
  }

  // Fallback: infer from result_type
  switch (resultType) {
    case "company_profile":
      return { provider: "Company Registry", section: "Company Profile Check" };
    case "directors":
      return { provider: "Company Registry", section: "Directors & Officers Check" };
    case "filings":
    case "filing_history":
      return { provider: "Company Registry", section: "Filing History Check" };
    case "insolvency":
      return { provider: "Company Registry", section: "Insolvency Check" };
    case "charges":
      return { provider: "Company Registry", section: "Charges & Mortgages Check" };
    case "address_verification":
      return { provider: "Company Registry", section: "Address Verification" };
    default:
      return { provider: "Registry API", section: resultType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
  }
}

function getSectionLabel(type: string): string {
  switch (type) {
    case "company_profile": return "Registration Check";
    case "directors": return "Directors & Officers Check";
    case "filings":
    case "filing_history": return "Filing History Check";
    case "insolvency": return "Insolvency Check";
    case "charges": return "Charges & Mortgages Check";
    case "address_verification": return "Address Verification";
    default: return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** Flatten a nested object into label-value pairs for display */
function flattenData(obj: any, prefix = ""): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  if (!obj || typeof obj !== "object") return rows;

  for (const [key, val] of Object.entries(obj)) {
    const label = prefix ? `${prefix} › ${formatLabel(key)}` : formatLabel(key);
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      if (typeof val[0] === "object") {
        val.forEach((item, i) => {
          rows.push(...flattenData(item, `${label} [${i + 1}]`));
        });
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

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RegistryVerificationTab({ borrowerId, organizationId, borrowerData }: RegistryVerificationTabProps) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    loadResults();
  }, [borrowerId]);

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
      toast.success("Registry lookup completed");
      await loadResults();
    } catch (err: any) {
      toast.error(err.message || "Registry lookup failed");
    }
    setFetching(false);
  };

  const grouped = results.reduce((acc: Record<string, any[]>, r) => {
    if (!acc[r.result_type]) acc[r.result_type] = [];
    acc[r.result_type].push(r);
    return acc;
  }, {});

  const typeIcon = (type: string) => {
    switch (type) {
      case "company_profile": return <Building2 className="h-4 w-4" />;
      case "directors": return <Users className="h-4 w-4" />;
      case "filings": case "filing_history": return <FileText className="h-4 w-4" />;
      case "insolvency": case "charges": return <AlertOctagon className="h-4 w-4" />;
      case "address_verification": return <MapPin className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const matchStatusBadge = (analysis: any) => {
    if (!analysis || Object.keys(analysis).length === 0) return null;
    const status = analysis.overall_match;
    if (status === "match") return <Badge variant="secondary" className="text-xs gap-1"><CheckCircle2 className="h-3 w-3" />Match</Badge>;
    if (status === "partial") return <Badge variant="outline" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Partial Match</Badge>;
    return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" />Mismatch</Badge>;
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Registry Verification</h3>
          <p className="text-sm text-muted-foreground">Data fetched from official company registries</p>
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
            <p className="text-sm text-muted-foreground">No registry data yet. Click "Run Lookup" to fetch official records.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={Object.keys(grouped)[0]} className="w-full">
          <TabsList className="flex flex-wrap gap-1">
            {Object.keys(grouped).map((type) => (
              <TabsTrigger key={type} value={type} className="text-xs capitalize gap-1.5">
                {typeIcon(type)}
                {type.replace(/_/g, " ")}
              </TabsTrigger>
            ))}
          </TabsList>
          {Object.entries(grouped).map(([type, items]: [string, any[]]) => (
            <TabsContent key={type} value={type} className="space-y-4 mt-4">
              {(items as any[]).map((item: any) => {
                const { provider, section } = getProviderInfo(type, item.source || item.registry_api_id);
                const dataRows = flattenData(item.data);

                return (
                  <Card key={item.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-normal gap-1">
                              <ExternalLink className="h-2.5 w-2.5" />
                              {provider}
                            </Badge>
                            <CardTitle className="text-sm">{section}</CardTitle>
                          </div>
                          <CardDescription className="text-xs">
                            Fetched {new Date(item.fetched_at).toLocaleString()}
                          </CardDescription>
                        </div>
                        {matchStatusBadge(item.match_analysis)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Match Analysis – Mismatch Table */}
                      {item.match_analysis && Array.isArray((item.match_analysis as any)?.differences) && (item.match_analysis as any).differences.length > 0 && (
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
                              {((item.match_analysis as any).differences as any[]).map((diff: any, i: number) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs font-medium">
                                    {formatLabel(diff.field)}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <span className="text-foreground">{diff.provided || "—"}</span>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <span className="text-foreground">{diff.registry || "—"}</span>
                                    {diff.distance_km && (
                                      <span className="ml-2 text-destructive font-medium">
                                        ({diff.distance_km} km apart)
                                      </span>
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

                      {/* Matched fields summary if match */}
                      {item.match_analysis?.overall_match === "match" && (
                        <div className="rounded-lg border border-[hsl(var(--chart-2))]/20 bg-[hsl(var(--chart-2))]/5 p-3 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                          <p className="text-sm text-foreground">All fields match the official registry records.</p>
                        </div>
                      )}

                      {/* Structured data table instead of raw JSON */}
                      {dataRows.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Registry Data</p>
                          <div className="rounded-lg border overflow-hidden">
                            <Table>
                              <TableBody>
                                {dataRows.map((row, i) => (
                                  <TableRow key={i} className="hover:bg-muted/30">
                                    <TableCell className="text-xs text-muted-foreground w-[40%] py-2 font-medium">
                                      {row.label}
                                    </TableCell>
                                    <TableCell className="text-xs text-foreground py-2">
                                      {row.value}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {dataRows.length === 0 && !item.match_analysis && (
                        <p className="text-sm text-muted-foreground text-center py-4">No data returned from the registry.</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
