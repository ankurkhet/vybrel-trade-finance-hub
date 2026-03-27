import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UserCheck } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import type { SignatoryFormData } from "@/lib/onboarding-types";

interface SignatoryInfoStepProps {
  data: SignatoryFormData;
  onChange: (data: SignatoryFormData) => void;
  disabled?: boolean;
}

export function SignatoryInfoStep({ data, onChange, disabled }: SignatoryInfoStepProps) {
  const update = (field: keyof SignatoryFormData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5 text-primary" />
          Person Signing Up
        </CardTitle>
        <CardDescription>Details of the person completing this application</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Full Name <span className="text-destructive">*</span></Label>
            <Input value={data.full_name} onChange={(e) => update("full_name", e.target.value)} placeholder="John Smith" disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label>Designation <span className="text-destructive">*</span></Label>
            <Input value={data.designation} onChange={(e) => update("designation", e.target.value)} placeholder="CEO, CFO, etc." disabled={disabled} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Date of Birth <span className="text-destructive">*</span></Label>
          <DateInput
            value={data.dob}
            onChange={(v) => update("dob", v)}
            disabled={disabled}
            maxToday
            className="sm:max-w-[320px]"
          />
        </div>

        <div className="space-y-3">
          <Label>Are you a Director / Authorised Signatory of the Company? <span className="text-destructive">*</span></Label>
          <RadioGroup
            value={data.is_director === null ? "" : data.is_director ? "yes" : "no"}
            onValueChange={(v) => update("is_director", v === "yes")}
            disabled={disabled}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="is-director-yes" />
              <Label htmlFor="is-director-yes" className="font-normal">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="is-director-no" />
              <Label htmlFor="is-director-no" className="font-normal">No</Label>
            </div>
          </RadioGroup>
        </div>

        {data.is_director === false && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide the details of the Director / Authorised Signatory who will sign on behalf of the company.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Director / Signatory Name <span className="text-destructive">*</span></Label>
                <Input value={data.director_name} onChange={(e) => update("director_name", e.target.value)} placeholder="Full name" disabled={disabled} />
              </div>
              <div className="space-y-2">
                <Label>Director / Signatory Email <span className="text-destructive">*</span></Label>
                <Input type="email" value={data.director_email} onChange={(e) => update("director_email", e.target.value)} placeholder="email@company.com" disabled={disabled} />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
