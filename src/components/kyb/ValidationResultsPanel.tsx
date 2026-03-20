import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

interface ValidationResultsPanelProps {
  borrowerData: any;
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

export function ValidationResultsPanel({ borrowerData, directors }: ValidationResultsPanelProps) {
  const [sanctionsResults, setSanctionsResults] = useState<Record<string, SanctionsResult>>({});
  const [bankResult, setBankResult] = useState<BankValidationResult | null>(null);
  const [nameVerifyResult, setNameVerifyResult] = useState<NameVerifyResult | null>(null);
  const [loadingSanctions, setLoadingSanctions] = useState<string | null>(null);
  const [loadingBank, setLoadingBank] = useState(false);
  const [loadingNameVerify, setLoadingNameVerify] = useState(false);

  const bankDetails = borrowerData?.bank_details || {};

  const runSanctionsCheck = async (name: string, key: string, birthDate?: string) => {
    setLoadingSanctions(key);
    try {
      const { data, error } = await supabase.functions.invoke("validation-lookup", {
        body: {
          action: "sanctions_check",
          name,
          birth_date: birthDate || undefined,
          country: borrowerData?.country || undefined,
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
        name: bankDetails.account_holder_name || borrowerData?.company_name || "",
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

  const companyName = borrowerData?.company_name || "";
  const companyKey = `company_${borrowerData?.id}`;
  const hasBankDetails = bankDetails.iban || bankDetails.sort_code;

  return (
    <div className="space-y-6">
      {/* Sanctions & PEP Screening */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4 text-primary" />
            Sanctions & PEP Screening
          </CardTitle>
          <CardDescription>OpenSanctions global AML/CFT and PEP checks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company check */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{companyName}</p>
                <p className="text-xs text-muted-foreground">Company entity</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SanctionsBadge result={sanctionsResults[companyKey]} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => runSanctionsCheck(companyName, companyKey)}
                disabled={loadingSanctions === companyKey}
              >
                {loadingSanctions === companyKey ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {/* Director checks */}
          {(directors || []).map((dir: any, idx: number) => {
            const dirName = `${dir.first_name} ${dir.last_name}`;
            const dirKey = `director_${dir.id || idx}`;
            return (
              <div key={dirKey} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{dirName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{dir.role || "Director"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SanctionsBadge result={sanctionsResults[dirKey]} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runSanctionsCheck(dirName, dirKey, dir.date_of_birth)}
                    disabled={loadingSanctions === dirKey}
                  >
                    {loadingSanctions === dirKey ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Run All button */}
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

      {/* Account Name Check (TrueLayer) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCheck className="h-4 w-4 text-primary" />
            Account Name Check
          </CardTitle>
          <CardDescription>TrueLayer Account Holder Name Verification</CardDescription>
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
                <div className={`rounded-lg border p-3 text-sm ${
                  nameVerifyResult.result === "Name Matches"
                    ? "border-[hsl(var(--chart-2))]/30 bg-[hsl(var(--chart-2))]/5"
                    : nameVerifyResult.result === "Name Does Not Match"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-muted/30"
                }`}>
                  <div className="flex items-center gap-2">
                    {nameVerifyResult.result === "Name Matches" ? (
                      <CheckCircle2 className="h-4 w-4 text-[hsl(var(--chart-2))]" />
                    ) : nameVerifyResult.result === "Name Does Not Match" ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{nameVerifyResult.result}</span>
                    {nameVerifyResult.confidence > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {nameVerifyResult.confidence}% confidence
                      </Badge>
                    )}
                  </div>
                  {nameVerifyResult.verified_name && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Verified as: <span className="font-medium text-foreground">{nameVerifyResult.verified_name}</span>
                    </p>
                  )}
                  {nameVerifyResult.error && (
                    <p className="mt-1 text-xs text-muted-foreground">{nameVerifyResult.error}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Source: TrueLayer (Sandbox)</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No bank details have been provided by this borrower yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bank Account Validation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-4 w-4 text-primary" />
            Bank Account Validation
          </CardTitle>
          <CardDescription>
            {bankDetails.iban ? "OpenIBAN validation" : bankDetails.sort_code ? "UK sort code validation" : "No bank details on file"}
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
              {bankResult?.bank_name && (
                <p className="text-xs text-muted-foreground">
                  Detected bank: <span className="font-medium text-foreground">{bankResult.bank_name}</span>
                  {" · Source: "}{bankResult.source}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No bank details have been provided by this borrower yet.
            </p>
          )}
        </CardContent>
      </Card>
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
