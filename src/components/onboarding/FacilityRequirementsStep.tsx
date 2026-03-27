import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CreditCard } from "lucide-react";
import { FACILITY_TYPES, emptyFacilityRequest } from "@/lib/onboarding-types";
import type { FacilityRequestData } from "@/lib/onboarding-types";

const CURRENCIES = ["GBP", "USD", "EUR", "AED", "CHF", "SGD", "HKD", "AUD", "CAD", "INR"];

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Facility Requirements
        </CardTitle>
        <CardDescription>Select one or more types of facility you are seeking. You can request multiple facilities.</CardDescription>
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
                  {FACILITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t.toLowerCase().replace(/\s+/g, "_")}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                <Label>Tenor (months)</Label>
                <Input type="number" value={fac.tenor_months} onChange={(e) => updateFacility(idx, "tenor_months", e.target.value)} placeholder="12" disabled={disabled} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pricing Notes</Label>
              <Textarea value={fac.pricing_notes} onChange={(e) => updateFacility(idx, "pricing_notes", e.target.value)} placeholder="Any pricing expectations or notes..." rows={2} disabled={disabled} />
            </div>
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
