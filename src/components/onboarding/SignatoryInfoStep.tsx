import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { UserCheck, CheckCircle2 } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { AddressInput } from "./AddressInput";
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>NRIC / Passport Number <span className="text-destructive">*</span></Label>
            <Input value={data.nric_passport} onChange={(e) => update("nric_passport", e.target.value)} placeholder="e.g. S1234567A" disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label>Telephone Number <span className="text-destructive">*</span></Label>
            <Input type="tel" value={data.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+44..." disabled={disabled} />
          </div>
        </div>

        <AddressInput
          label="Residential Address"
          value={data.address}
          onChange={(addr) => update("address", addr)}
          required
          disabled={disabled}
        />

        <div className="space-y-2">
          <Label>LinkedIn URL</Label>
          <Input type="url" value={data.linkedin_url} onChange={(e) => update("linkedin_url", e.target.value)} placeholder="https://linkedin.com/in/..." disabled={disabled} />
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

        {/* NDA Acceptance */}
        <div className={`rounded-lg border p-4 space-y-2 ${data.nda_status === "signed" ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "border-amber-300 bg-amber-50 dark:bg-amber-950/20"}`}>
          <div className="flex items-start gap-3">
            {data.nda_status === "signed" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            ) : (
              <Checkbox
                id="nda-accept"
                checked={(data.nda_status as string) === "signed"}
                onCheckedChange={(checked) => update("nda_status", checked ? "signed" : "pending")}
                disabled={disabled}
                className="mt-0.5"
              />
            )}
            <div className="flex-1">
              <Label htmlFor="nda-accept" className={`font-medium cursor-pointer ${data.nda_status === "signed" ? "text-green-700 dark:text-green-400" : ""}`}>
                {data.nda_status === "signed" ? "Non-Disclosure Agreement Signed" : "I agree to the Non-Disclosure Agreement"} <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                By checking this box, I confirm I have read and agree to Vybrel's NDA, which governs the confidentiality of information shared during this onboarding process.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
