import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  Landmark,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  User,
  UserCheck,
  ExternalLink,
} from "lucide-react";

interface ValidationResultsPanelProps {
  borrowerData?: any;
  entityData?: {
    id: string;
    name: string;
    country?: string;
    bank_details?: any;
  };
  entityType?: "borrower" | "originator" | "funder" | "counterparty" | "broker";
  directors?: any[];
}

interface SanctionsResult {
  screened: boolean;
  clear?: boolean;
  total_hits?: number;
  sanctions_hits?: number;
  pep_hits?: number;
  matches?: any[];
  error?: string;
  checked_at?: string;
}

interface BankValidationResult {
  valid: boolean;
  bank_name?: string | null;
  confidence?: number;
  source?: string;
  iban?: string;
  sort_code?: string;
  error?: string;
}

interface NameVerifyResult {
  result: "Name Matches" | "Name Does Not Match" | "Unable to Verify";
  confidence: number;
  verified_name?: string;
  error?: string;
}

export function ValidationResultsPanel({ borrowerData, entityData, entityType = "borrower", directors }: ValidationResultsPanelProps) {
  const [sanctionsResults, setSanctionsResults] = useState<Record<string, SanctionsResult>>({});
  const [bankResult, setBankResult] = useState<BankValidationResult | null>(null);
  const [nameVerifyResult, setNameVerifyResult] = useState<NameVerifyResult | null>(null);
  const [loadingSanctions, setLoadingSanctions] = useState<string | null>(null);
  const [loadingBank, setLoadingBank] = useState(false);
  const [loadingNameVerify, setLoadingNameVerify] = useState(false);

  const entity = entityData || {
    id: borrowerData?.id,
    name: borrowerData?.company_name || "",
    country: borrowerData?.country,
    bank_details: borrowerData?.bank_details,
  };
  const bankDetails = entity.bank_details || borrowerData?.bank_details || {};

  const runSanctionsCheck = async (name: string, key: string, birthDate?: string) => {
    setLoadingSanctions(key);
    try {
      const { data, error } = await supabase.functions.invoke("validation-lookup", {
        body: {
          action: "sanctions_check",
          name,
          birth_date: birthDate || undefined,
          country: entity.country || borrowerData?.country || undefined,
        },
      });
      if (!error && data) {
        setSanctionsResults((prev) => ({ ...prev, [key]: data }));
      } else {
        setSanctionsResults((prev) => ({ ...prev, [key]: { screened: false, error: error?.message || "Failed" } }));
      }
    } catch (err: any) {
      setSanctionsResults((prev) => ({ ...prev, [key]: { screened: false, error: err.message } }));
    }
    setLoadingSanctions(null);
  };

  const runBankValidation = async () => {
    setLoadingBank(true);
    try {
      if (bankDetails.iban) {
        const { data } = await supabase.functions.invoke("validation-lookup", {
          body: { action: "validate_iban", iban: bankDetails.iban },
        });
        if (data) setBankResult(data);
      } else if (bankDetails.sort_code) {
        const { data } = await supabase.functions.invoke("validation-lookup", {
          body: { action: "validate_sortcode", sort_code: bankDetails.sort_code, account_number: bankDetails.account_number },
        });
        if (data) setBankResult(data);
      }
    } catch { /* ignore */ }
    setLoadingBank(false);
  };

  const runNameVerification = async () => {
    setLoadingNameVerify(true);
    try {
      const body: any = {
        action: "verify_name",
        name: bankDetails.account_holder_name || entity.name || borrowerData?.company_name || "",
      };
      if (bankDetails.iban) {
        body.iban = bankDetails.iban;
      } else if (bankDetails.sort_code) {
        body.sort_code = bankDetails.sort_code;
        body.account_number = bankDetails.account_number;
      }
      const { data, error } = await supabase.functions.invoke("truelayer-name-verify", { body });
      if (!error && data) {
        setNameVerifyResult(data);
      } else {
        setNameVerifyResult({ result: "Unable to Verify", confidence: 0, error: error?.message });
      }
    } catch (err: any) {
      setNameVerifyResult({ result: "Unable to Verify", confidence: 0, error: err.message });
    }
    setLoadingNameVerify(false);
  };

  const companyName = entity.name || borrowerData?.company_name || "";
  const companyKey = `${entityType}_${entity.id || borrowerData?.id}`;
  const hasBankDetails = bankDetails.iban || bankDetails.sort_code;

  return (
    <div className="space-y-6">
      {/* ── Sanctions & PEP Screening ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-normal gap-1">
                  <ExternalLink className="h-2.5 w-2.5" />
                  OpenSanctions
                </Badge>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Sanctions & PEP Screening
                </CardTitle>
              </div>
              <CardDescription>Global AML/CFT sanctions list and Politically Exposed Persons checks</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Company check row */}
          <SanctionsCheckRow
            name={companyName}
            subtitle="Company Entity"
            icon={<Shield className="h-4 w-4 text-primary" />}
            iconBg="bg-primary/10"
            result={sanctionsResults[companyKey]}
            loading={loadingSanctions === companyKey}
            onRun={() => runSanctionsCheck(companyName, companyKey)}
          />

          {/* Director check rows */}
          {(directors || []).map((dir: any, idx: number) => {
            const dirName = `${dir.first_name} ${dir.last_name}`;
            const dirKey = `director_${dir.id || idx}`;
            return (
              <SanctionsCheckRow
                key={dirKey}
                name={dirName}
                subtitle={`${(dir.role || "Director").replace(/\b\w/g, (c: string) => c.toUpperCase())} · Individual`}
                icon={<User className="h-4 w-4 text-muted-foreground" />}
                iconBg="bg-muted"
                result={sanctionsResults[dirKey]}
                loading={loadingSanctions === dirKey}
                onRun={() => runSanctionsCheck(dirName, dirKey, dir.date_of_birth)}
              />
            );
          })}

          {/* Expanded results table */}
          {Object.entries(sanctionsResults).some(([, r]) => r.matches && r.matches.length > 0) && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3 mt-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-sm font-semibold text-foreground">Screening Hits Detail</p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Entity Screened</TableHead>
                    <TableHead className="text-xs">Match Name</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Score</TableHead>
                    <TableHead className="text-xs">Datasets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(sanctionsResults).flatMap(([key, r]) =>
                    (r.matches || []).map((m: any, i: number) => (
                      <TableRow key={`${key}-${i}`}>
                        <TableCell className="text-xs font-medium">
                          {key.startsWith("director_") ? "Individual" : "Company"}
                        </TableCell>
                        <TableCell className="text-xs">{m.name || m.caption || "—"}</TableCell>
                        <TableCell className="text-xs capitalize">{m.schema || m.type || "—"}</TableCell>
                        <TableCell className="text-xs">{m.score ? `${(m.score * 100).toFixed(0)}%` : "—"}</TableCell>
                        <TableCell className="text-xs">{(m.datasets || []).join(", ") || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              await runSanctionsCheck(companyName, companyKey);
              for (let i = 0; i < (directors || []).length; i++) {
                const dir = directors![i];
                const dirName = `${dir.first_name} ${dir.last_name}`;
                await runSanctionsCheck(dirName, `director_${dir.id || i}`, dir.date_of_birth);
              }
            }}
            disabled={!!loadingSanctions}
          >
            {loadingSanctions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
            Screen All
          </Button>
        </CardContent>
      </Card>

      {/* ── Account Name Verification ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-normal gap-1">
              <ExternalLink className="h-2.5 w-2.5" />
              TrueLayer
            </Badge>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" />
              Account Holder Name Verification
            </CardTitle>
          </div>
          <CardDescription>Verifies bank account holder name matches the entity on file</CardDescription>
        </CardHeader>
        <CardContent>
          {hasBankDetails ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">
                    {bankDetails.account_holder_name || companyName}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {bankDetails.iban || `${bankDetails.sort_code} / ${bankDetails.account_number || "—"}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {nameVerifyResult && <NameVerifyBadge result={nameVerifyResult} />}
                  <Button variant="outline" size="sm" onClick={runNameVerification} disabled={loadingNameVerify}>
                    {loadingNameVerify ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              {nameVerifyResult && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground font-medium w-[40%] py-2">Result</TableCell>
                        <TableCell className="text-xs py-2">
                          <div className="flex items-center gap-2">
                            {nameVerifyResult.result === "Name Matches" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--chart-2))]" />
                            ) : nameVerifyResult.result === "Name Does Not Match" ? (
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="font-medium">{nameVerifyResult.result}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {nameVerifyResult.confidence > 0 && (
                        <TableRow>
                          <TableCell className="text-xs text-muted-foreground font-medium py-2">Confidence</TableCell>
                          <TableCell className="text-xs py-2">{nameVerifyResult.confidence}%</TableCell>
                        </TableRow>
                      )}
                      {nameVerifyResult.verified_name && (
                        <TableRow>
                          <TableCell className="text-xs text-muted-foreground font-medium py-2">Verified Name</TableCell>
                          <TableCell className="text-xs py-2 font-medium">{nameVerifyResult.verified_name}</TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground font-medium py-2">Provider</TableCell>
                        <TableCell className="text-xs py-2">TrueLayer (Sandbox)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground font-medium py-2">Check Type</TableCell>
                        <TableCell className="text-xs py-2">Account Holder Name Verification</TableCell>
                      </TableRow>
                      {nameVerifyResult.error && (
                        <TableRow>
                          <TableCell className="text-xs text-muted-foreground font-medium py-2">Error</TableCell>
                          <TableCell className="text-xs py-2 text-destructive">{nameVerifyResult.error}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No bank details have been provided yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Bank Account Validation ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-normal gap-1">
              <ExternalLink className="h-2.5 w-2.5" />
              {bankDetails.iban ? "OpenIBAN" : bankDetails.sort_code ? "Sortcode.co.uk" : "Bank Validator"}
            </Badge>
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              Bank Account Validation
            </CardTitle>
          </div>
          <CardDescription>
            {bankDetails.iban ? "IBAN structure and bank code validation" : bankDetails.sort_code ? "UK sort code and account number validation" : "No bank details on file"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(bankDetails.iban || bankDetails.sort_code) ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-mono">
                    {bankDetails.iban || `${bankDetails.sort_code} / ${bankDetails.account_number || "—"}`}
                  </p>
                  {bankDetails.bank_name && (
                    <p className="text-xs text-muted-foreground">{bankDetails.bank_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {bankResult && (
                    bankResult.valid ? (
                      <Badge variant="default" className="text-[10px] gap-1 bg-[hsl(var(--chart-2))] hover:bg-[hsl(var(--chart-2))]/80">
                        <CheckCircle2 className="h-3 w-3" /> Valid
                        {bankResult.confidence && ` (${bankResult.confidence}%)`}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <XCircle className="h-3 w-3" /> Invalid
                      </Badge>
                    )
                  )}
                  <Button variant="outline" size="sm" onClick={runBankValidation} disabled={loadingBank}>
                    {loadingBank ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              {bankResult && (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground font-medium w-[40%] py-2">Status</TableCell>
                        <TableCell className="text-xs py-2">
                          <span className={bankResult.valid ? "text-[hsl(var(--chart-2))]" : "text-destructive"}>
                            {bankResult.valid ? "Valid" : "Invalid"}
                          </span>
                        </TableCell>
                      </TableRow>
                      {bankResult.bank_name && (
                        <TableRow>
                          <TableCell className="text-xs text-muted-foreground font-medium py-2">Bank Name</TableCell>
                          <TableCell className="text-xs py-2 font-medium">{bankResult.bank_name}</TableCell>
                        </TableRow>
                      )}
                      {bankResult.confidence && (
                        <TableRow>
                          <TableCell className="text-xs text-muted-foreground font-medium py-2">Confidence</TableCell>
                          <TableCell className="text-xs py-2">{bankResult.confidence}%</TableCell>
                        </TableRow>
                      )}
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground font-medium py-2">Provider</TableCell>
                        <TableCell className="text-xs py-2">{bankResult.source || (bankDetails.iban ? "OpenIBAN" : "Sortcode.co.uk")}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs text-muted-foreground font-medium py-2">Check Type</TableCell>
                        <TableCell className="text-xs py-2">{bankDetails.iban ? "IBAN Validation" : "Sort Code Validation"}</TableCell>
                      </TableRow>
                      {bankResult.error && (
                        <TableRow>
                          <TableCell className="text-xs text-muted-foreground font-medium py-2">Error</TableCell>
                          <TableCell className="text-xs py-2 text-destructive">{bankResult.error}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No bank details have been provided yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Sub-components ── */

function SanctionsCheckRow({
  name,
  subtitle,
  icon,
  iconBg,
  result,
  loading,
  onRun,
}: {
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  result?: SanctionsResult;
  loading: boolean;
  onRun: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <SanctionsBadge result={result} />
        <Button variant="outline" size="sm" onClick={onRun} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function NameVerifyBadge({ result }: { result: NameVerifyResult }) {
  if (result.result === "Name Matches") {
    return (
      <Badge variant="default" className="text-[10px] gap-1 bg-[hsl(var(--chart-2))] hover:bg-[hsl(var(--chart-2))]/80">
        <CheckCircle2 className="h-3 w-3" /> Match
      </Badge>
    );
  }
  if (result.result === "Name Does Not Match") {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1">
        <XCircle className="h-3 w-3" /> Mismatch
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] gap-1">
      <AlertTriangle className="h-3 w-3" /> Unverified
    </Badge>
  );
}

function SanctionsBadge({ result }: { result?: SanctionsResult }) {
  if (!result) return <Badge variant="outline" className="text-[10px]">Not checked</Badge>;
  if (result.error) return <Badge variant="outline" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> Error</Badge>;
  if (!result.screened) return <Badge variant="outline" className="text-[10px]">Not screened</Badge>;
  if (result.clear) {
    return (
      <Badge variant="default" className="text-[10px] gap-1 bg-[hsl(var(--chart-2))] hover:bg-[hsl(var(--chart-2))]/80">
        <CheckCircle2 className="h-3 w-3" /> Clear
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="text-[10px] gap-1">
      <AlertTriangle className="h-3 w-3" />
      {result.sanctions_hits ? `${result.sanctions_hits} sanction` : ""}
      {result.sanctions_hits && result.pep_hits ? " + " : ""}
      {result.pep_hits ? `${result.pep_hits} PEP` : ""}
      {` hit${(result.total_hits || 0) > 1 ? "s" : ""}`}
    </Badge>
  );
}
