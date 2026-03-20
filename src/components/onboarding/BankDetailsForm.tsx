import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Landmark, Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react";

interface BankDetails {
  account_type: "iban" | "uk_sort_code" | "";
  iban: string;
  sort_code: string;
  account_number: string;
  bank_name: string;
  account_holder_name: string;
  swift_bic: string;
}

interface ValidationResult {
  valid: boolean;
  bank_name?: string | null;
  bic?: string | null;
  confidence?: number;
  source?: string;
  messages?: string[];
  branch?: string | null;
}

interface BankDetailsFormProps {
  value: BankDetails;
  onChange: (details: BankDetails) => void;
  disabled?: boolean;
}

const emptyBankDetails: BankDetails = {
  account_type: "",
  iban: "",
  sort_code: "",
  account_number: "",
  bank_name: "",
  account_holder_name: "",
  swift_bic: "",
};

export { emptyBankDetails };
export type { BankDetails };

export function BankDetailsForm({ value, onChange, disabled }: BankDetailsFormProps) {
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const update = (field: keyof BankDetails, val: string) => {
    const updated = { ...value, [field]: val };
    onChange(updated);
    setValidation(null);
  };

  // Auto-validate when IBAN or sort code changes
  const triggerValidation = useCallback(async (details: BankDetails) => {
    if (details.account_type === "iban" && details.iban.replace(/\s/g, "").length >= 15) {
      setValidating(true);
      try {
        const { data, error } = await supabase.functions.invoke("validation-lookup", {
          body: { action: "validate_iban", iban: details.iban },
        });
        if (!error && data) {
          setValidation(data);
          if (data.bank_name && !details.bank_name) {
            onChange({ ...details, bank_name: data.bank_name, swift_bic: data.bic || details.swift_bic });
          }
        }
      } catch { /* ignore */ }
      setValidating(false);
    } else if (details.account_type === "uk_sort_code" && details.sort_code.replace(/[-\s]/g, "").length === 6) {
      setValidating(true);
      try {
        const { data, error } = await supabase.functions.invoke("validation-lookup", {
          body: { action: "validate_sortcode", sort_code: details.sort_code, account_number: details.account_number },
        });
        if (!error && data) {
          setValidation(data);
          if (data.bank_name && !details.bank_name) {
            onChange({ ...details, bank_name: data.bank_name });
          }
        }
      } catch { /* ignore */ }
      setValidating(false);
    }
  }, [onChange]);

  useEffect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => triggerValidation(value), 800);
    setDebounceTimer(timer);
    return () => clearTimeout(timer);
  }, [value.iban, value.sort_code, value.account_number, value.account_type]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          Bank Account Details
        </CardTitle>
        <CardDescription>For settlement payments</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Holder Name */}
        <div className="space-y-2">
          <Label>Account Holder Name</Label>
          <Input
            value={value.account_holder_name}
            onChange={(e) => update("account_holder_name", e.target.value)}
            placeholder="Company Ltd"
            disabled={disabled}
          />
        </div>

        {/* Account Type */}
        <div className="space-y-2">
          <Label>Account Type <span className="text-destructive">*</span></Label>
          <Select value={value.account_type} onValueChange={(v) => update("account_type", v)} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="iban">IBAN (International)</SelectItem>
              <SelectItem value="uk_sort_code">UK Sort Code + Account Number</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* IBAN fields */}
        {value.account_type === "iban" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>IBAN <span className="text-destructive">*</span></Label>
                <ValidationBadge validating={validating} validation={validation} />
              </div>
              <Input
                value={value.iban}
                onChange={(e) => update("iban", e.target.value.toUpperCase())}
                placeholder="DE89 3704 0044 0532 0130 00"
                className="font-mono tracking-wider"
                disabled={disabled}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SWIFT / BIC</Label>
                <Input
                  value={value.swift_bic}
                  onChange={(e) => update("swift_bic", e.target.value.toUpperCase())}
                  placeholder="COBADEFFXXX"
                  className="font-mono"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label>Bank Name</Label>
                <Input
                  value={value.bank_name}
                  onChange={(e) => update("bank_name", e.target.value)}
                  placeholder="Auto-detected"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        )}

        {/* UK Sort Code fields */}
        {value.account_type === "uk_sort_code" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Sort Code <span className="text-destructive">*</span></Label>
                  <ValidationBadge validating={validating} validation={validation} />
                </div>
                <Input
                  value={value.sort_code}
                  onChange={(e) => update("sort_code", e.target.value)}
                  placeholder="20-00-00"
                  className="font-mono"
                  maxLength={8}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number <span className="text-destructive">*</span></Label>
                <Input
                  value={value.account_number}
                  onChange={(e) => update("account_number", e.target.value)}
                  placeholder="12345678"
                  className="font-mono"
                  maxLength={8}
                  disabled={disabled}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={value.bank_name}
                onChange={(e) => update("bank_name", e.target.value)}
                placeholder="Auto-detected"
                disabled={disabled}
              />
            </div>
          </div>
        )}

        {/* Validation detail card */}
        {validation && (
          <div className={`rounded-lg border p-3 text-sm ${validation.valid ? "border-[hsl(var(--chart-2))]/30 bg-[hsl(var(--chart-2))]/5" : "border-destructive/30 bg-destructive/5"}`}>
            <div className="flex items-center gap-2">
              {validation.valid ? (
                <CheckCircle2 className="h-4 w-4 text-[hsl(var(--chart-2))]" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="font-medium">
                {validation.valid ? "Account validated" : "Validation failed"}
              </span>
              {validation.confidence && (
                <Badge variant="secondary" className="text-[10px]">
                  {validation.confidence}% confidence
                </Badge>
              )}
            </div>
            {validation.bank_name && (
              <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {validation.bank_name}
                {validation.branch && <span>– {validation.branch}</span>}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Source: {validation.source}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ValidationBadge({ validating, validation }: { validating: boolean; validation: ValidationResult | null }) {
  if (validating) {
    return (
      <Badge variant="secondary" className="text-[10px] gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Validating…
      </Badge>
    );
  }
  if (!validation) return null;
  return validation.valid ? (
    <Badge variant="default" className="text-[10px] gap-1 bg-[hsl(var(--chart-2))] hover:bg-[hsl(var(--chart-2))]/80">
      <CheckCircle2 className="h-3 w-3" /> Valid
    </Badge>
  ) : (
    <Badge variant="destructive" className="text-[10px] gap-1">
      <XCircle className="h-3 w-3" /> Invalid
    </Badge>
  );
}
