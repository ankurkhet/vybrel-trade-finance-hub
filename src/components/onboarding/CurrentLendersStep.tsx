import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Landmark, ChevronDown, ChevronUp } from "lucide-react";
import { emptyLender } from "@/lib/onboarding-types";
import type { LenderData } from "@/lib/onboarding-types";
import { useState } from "react";

const CURRENCIES = ["GBP", "USD", "EUR", "AED", "CHF", "SGD", "HKD", "AUD", "CAD", "INR"];

interface CurrentLendersStepProps {
  lenders: LenderData[];
  onChange: (lenders: LenderData[]) => void;
  disabled?: boolean;
}

export function CurrentLendersStep({ lenders, onChange, disabled }: CurrentLendersStepProps) {
  const [expanded, setExpanded] = useState<number | null>(lenders.length > 0 ? 0 : null);

  const addLender = () => {
    onChange([...lenders, { ...emptyLender }]);
    setExpanded(lenders.length);
  };

  const removeLender = (idx: number) => {
    onChange(lenders.filter((_, i) => i !== idx));
    if (expanded === idx) setExpanded(null);
    else if (expanded !== null && expanded > idx) setExpanded(expanded - 1);
  };

  const updateLender = (idx: number, field: keyof LenderData, value: any) => {
    const updated = [...lenders];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          Current Lenders / Bankers
        </CardTitle>
        <CardDescription>Add all current lenders, banks, and credit facility providers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lenders.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Landmark className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No current lenders added. Click below to add one.</p>
          </div>
        )}

        {lenders.map((lender, idx) => (
          <div key={idx} className="rounded-lg border">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors"
              onClick={() => setExpanded(expanded === idx ? null : idx)}
              disabled={disabled}
            >
              <span className="font-medium text-sm text-foreground">
                {lender.lender_name || `Lender ${idx + 1}`}
              </span>
              <div className="flex items-center gap-2">
                {!disabled && (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); removeLender(idx); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                {expanded === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {expanded === idx && (
              <div className="space-y-4 border-t px-4 py-4">
                <div className="space-y-2">
                  <Label>Lender / Bank Name <span className="text-destructive">*</span></Label>
                  <Input value={lender.lender_name} onChange={(e) => updateLender(idx, "lender_name", e.target.value)} placeholder="Barclays, HSBC..." disabled={disabled} />
                </div>

                <div className="flex items-center space-x-3">
                  <Switch checked={lender.has_facilities} onCheckedChange={(v) => updateLender(idx, "has_facilities", v)} disabled={disabled} />
                  <Label>Do you have credit facilities with this lender?</Label>
                </div>

                {lender.has_facilities && (
                  <div className="space-y-4 rounded-lg bg-muted/30 p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nature of Facilities</Label>
                        <Input value={lender.facility_nature} onChange={(e) => updateLender(idx, "facility_nature", e.target.value)} placeholder="Overdraft, Term Loan..." disabled={disabled} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-2">
                          <Label>Amount</Label>
                          <Input type="number" value={lender.facility_amount} onChange={(e) => updateLender(idx, "facility_amount", e.target.value)} placeholder="500,000" disabled={disabled} />
                        </div>
                        <div className="space-y-2">
                          <Label>Currency</Label>
                          <Select value={lender.currency} onValueChange={(v) => updateLender(idx, "currency", v)} disabled={disabled}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <Switch checked={lender.is_secured} onCheckedChange={(v) => updateLender(idx, "is_secured", v)} disabled={disabled} />
                      <Label>Secured Facility</Label>
                    </div>

                    <div className="space-y-2">
                      <Label>Repayment Schedule</Label>
                      <Textarea value={lender.repayment_schedule} onChange={(e) => updateLender(idx, "repayment_schedule", e.target.value)} placeholder="Monthly repayment of..." rows={2} disabled={disabled} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {!disabled && (
          <Button type="button" variant="outline" className="w-full" onClick={addLender}>
            <Plus className="mr-2 h-4 w-4" /> Add Lender / Bank
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
