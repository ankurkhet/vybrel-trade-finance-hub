import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { FACILITY_CATEGORIES, FACILITY_TYPES, emptyFacilityRequest } from "@/lib/onboarding-types";
import type { FacilityRequestData } from "@/lib/onboarding-types";

const CURRENCIES = ["GBP", "USD", "EUR", "AED", "CHF", "SGD", "HKD", "AUD", "CAD", "INR"];

const FUNDING_TYPES = FACILITY_CATEGORIES[0].types;

interface FacilityRequirementsStepProps {
  facilities: FacilityRequestData[];
  onChange: (facilities: FacilityRequestData[]) => void;
  otherInvoiceFacilities: string;
  onOtherChange: (val: string) => void;
  disabled?: boolean;
}

export function FacilityRequirementsStep({ facilities, onChange, otherInvoiceFacilities, onOtherChange, disabled }: FacilityRequirementsStepProps) {
  const addFacility = () => onChange([...facilities, { ...emptyFacilityRequest }]);

  const removeFacility = (idx: number) => onChange(facilities.filter((_, i) => i !== idx));

  const updateFacility = (idx: number, field: keyof FacilityRequestData, value: string) => {
    const updated = [...facilities];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const isFundingType = (type: string) => {
    return FUNDING_TYPES.some(t => t.toLowerCase().replace(/[\s\/]+/g, "_") === type);
  };

  const isPaymentAutomation = (type: string) => {
    return type === "payment_/_automation_of_receivables";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Facility Requirements
        </CardTitle>
        <CardDescription>
          Choose between <strong>Funding</strong> (with specific sub-types requiring amount & tenor) or <strong>Payment / Automation of Receivables</strong> (no additional details needed).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {facilities.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CreditCard className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No facility requests yet. Add at least one.</p>
          </div>
        )}

        {facilities.map((fac, idx) => (
          <div key={idx} className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Facility {idx + 1}</span>
              {!disabled && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFacility(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label>Type of Facility <span className="text-destructive">*</span></Label>
              <Select value={fac.facility_type} onValueChange={(v) => updateFacility(idx, "facility_type", v)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder="Select facility type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem disabled value="__funding_header" className="font-semibold text-xs text-muted-foreground">
                    — Funding —
                  </SelectItem>
                  {FUNDING_TYPES.map((t) => (
                    <SelectItem key={t} value={t.toLowerCase().replace(/[\s\/]+/g, "_")}>{t}</SelectItem>
                  ))}
                  <SelectItem disabled value="__payment_header" className="font-semibold text-xs text-muted-foreground">
                    — Other —
                  </SelectItem>
                  <SelectItem value="payment_/_automation_of_receivables">Payment / Automation of Receivables</SelectItem>
                  <SelectItem value="dynamic_discounting">Dynamic Discounting</SelectItem>
                  <SelectItem value="other_short-term_credit">Other Short-Term Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Show amount/tenor only for Funding types */}
            {fac.facility_type && !isPaymentAutomation(fac.facility_type) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Amount Required <span className="text-destructive">*</span></Label>
                  <Input type="number" value={fac.amount} onChange={(e) => updateFacility(idx, "amount", e.target.value)} placeholder="2,500,000" disabled={disabled} />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={fac.currency} onValueChange={(v) => updateFacility(idx, "currency", v)} disabled={disabled}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tenor (months) <span className="text-destructive">*</span></Label>
                  <Input type="number" value={fac.tenor_months} onChange={(e) => updateFacility(idx, "tenor_months", e.target.value)} placeholder="12" disabled={disabled} />
                </div>
              </div>
            )}

            {isPaymentAutomation(fac.facility_type) && (
              <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                No additional details required for Payment / Automation of Receivables at this stage.
              </div>
            )}

            {fac.facility_type && !isPaymentAutomation(fac.facility_type) && (
              <div className="space-y-2">
                <Label>Pricing Notes</Label>
                <Textarea value={fac.pricing_notes} onChange={(e) => updateFacility(idx, "pricing_notes", e.target.value)} placeholder="Any pricing expectations or notes..." rows={2} disabled={disabled} />
              </div>
            )}
          </div>
        ))}

        {!disabled && (
          <Button type="button" variant="outline" className="w-full" onClick={addFacility}>
            <Plus className="mr-2 h-4 w-4" /> Add Facility Request
          </Button>
        )}

        <div className="space-y-2 pt-2 border-t">
          <Label>Details of other Invoice Discounting / Factoring / Receivable Financing Facility (if any)</Label>
          <Textarea value={otherInvoiceFacilities} onChange={(e) => onOtherChange(e.target.value)} placeholder="Describe any existing facilities..." rows={3} disabled={disabled} />
        </div>
      </CardContent>
    </Card>
  );
}
