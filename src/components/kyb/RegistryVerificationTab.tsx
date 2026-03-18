import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Building2, Users, FileText, AlertOctagon, MapPin } from "lucide-react";
import { toast } from "sonner";

interface RegistryVerificationTabProps {
  borrowerId: string;
  organizationId: string;
  borrowerData?: any;
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
    if (status === "match") return <Badge variant="secondary" className="text-xs"><CheckCircle2 className="mr-1 h-3 w-3" />Match</Badge>;
    if (status === "partial") return <Badge variant="outline" className="text-xs"><AlertTriangle className="mr-1 h-3 w-3" />Partial</Badge>;
    return <Badge variant="destructive" className="text-xs"><XCircle className="mr-1 h-3 w-3" />Mismatch</Badge>;
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
          {Object.entries(grouped).map(([type, items]) => (
            <TabsContent key={type} value={type} className="space-y-3">
              {items.map((item: any) => (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm capitalize">{type.replace(/_/g, " ")}</CardTitle>
                      {matchStatusBadge(item.match_analysis)}
                    </div>
                    <CardDescription className="text-xs">
                      Fetched {new Date(item.fetched_at).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Match analysis details */}
                    {item.match_analysis && item.match_analysis.differences && (
                      <div className="mb-3 rounded-md bg-muted/50 p-3 space-y-1">
                        <p className="text-xs font-medium text-foreground">Match Analysis</p>
                        {item.match_analysis.differences.map((diff: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <Badge variant={diff.severity === "high" ? "destructive" : "outline"} className="text-[10px] shrink-0">{diff.field}</Badge>
                            <span className="text-muted-foreground">
                              Provided: <span className="text-foreground">{diff.provided || "—"}</span> | Registry: <span className="text-foreground">{diff.registry || "—"}</span>
                              {diff.distance_km && <span className="ml-1 text-destructive">({diff.distance_km} km apart)</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Raw data */}
                    <pre className="max-h-60 overflow-auto rounded bg-muted p-3 text-xs text-foreground">
                      {JSON.stringify(item.data, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
