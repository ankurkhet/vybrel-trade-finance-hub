import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Building2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AddressInput } from "./AddressInput";
import { COUNTRIES, INDUSTRIES } from "@/lib/onboarding-types";
import type { CompanyFormData, AddressData } from "@/lib/onboarding-types";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState, useEffect } from "react";
import { sicToIndustry } from "@/lib/sic-industry-map";

interface CompanyInfoStepProps {
  data: CompanyFormData;
  onChange: (data: CompanyFormData) => void;
  disabled?: boolean;
}

export function CompanyInfoStep({ data, onChange, disabled }: CompanyInfoStepProps) {
  const [countryOpen, setCountryOpen] = useState(false);

  const update = (field: keyof CompanyFormData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  // Auto-map SIC codes to industry
  useEffect(() => {
    if (data.sic_codes) {
      const mapped = sicToIndustry(data.sic_codes);
      if (mapped && mapped !== data.industry) {
        onChange({ ...data, industry: mapped });
      }
    }
  }, [data.sic_codes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Company Information
        </CardTitle>
        <CardDescription>As it appears in registration documents</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Company Name */}
        <div className="space-y-2">
          <Label>Company Name (as per Registration Documents) <span className="text-destructive">*</span></Label>
          <Input value={data.company_name} onChange={(e) => update("company_name", e.target.value)} placeholder="Acme Corp Ltd" disabled={disabled} />
        </div>

        {/* Trading Name + Reg Number */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Trading Name (if different)</Label>
            <Input value={data.trading_name} onChange={(e) => update("trading_name", e.target.value)} placeholder="Acme" disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label>Registration / Company Number</Label>
            <Input value={data.registration_number} onChange={(e) => update("registration_number", e.target.value)} placeholder="12345678" disabled={disabled} />
          </div>
        </div>

        {/* Country + Incorporation Date */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Country <span className="text-destructive">*</span></Label>
            <Popover open={countryOpen} onOpenChange={setCountryOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={countryOpen} className="w-full justify-between" disabled={disabled}>
                  {data.country ? COUNTRIES.find((c) => c.code === data.country)?.name || data.country : "Select country..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search country..." />
                  <CommandList>
                    <CommandEmpty>No country found.</CommandEmpty>
                    <CommandGroup>
                      {COUNTRIES.map((c) => (
                        <CommandItem key={c.code} value={c.name} onSelect={() => { update("country", c.code); setCountryOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", data.country === c.code ? "opacity-100" : "opacity-0")} />
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Incorporation Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !data.incorporation_date && "text-muted-foreground")} disabled={disabled}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data.incorporation_date ? format(new Date(data.incorporation_date), "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={data.incorporation_date ? new Date(data.incorporation_date) : undefined}
                  onSelect={(d) => update("incorporation_date", d ? d.toISOString().split("T")[0] : "")}
                  disabled={(d) => d > new Date()}
                  initialFocus
                  captionLayout="dropdown-buttons"
                  fromYear={1900}
                  toYear={new Date().getFullYear()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* SIC Code(s) — moved before Industry */}
        <div className="space-y-2">
          <Label>SIC Code(s)</Label>
          <Input value={data.sic_codes} onChange={(e) => update("sic_codes", e.target.value)} placeholder="e.g. 64992 – Factoring, 82920 – Packaging" disabled={disabled} />
          <p className="text-xs text-muted-foreground">Industry will auto-select based on SIC code</p>
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <Label>Industry / Sector <span className="text-destructive">*</span></Label>
          <Select value={data.industry} onValueChange={(v) => update("industry", v)} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((i) => (
                <SelectItem key={i} value={i.toLowerCase().replace(/\s+/g, "_")}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Registered Address */}
        <AddressInput
          label="Registered Office Address"
          value={data.registered_address}
          onChange={(addr) => update("registered_address", addr)}
          required
          disabled={disabled}
        />

        {/* Trading Address */}
        <AddressInput
          label="Trading / Operational Address"
          value={data.trading_address}
          onChange={(addr) => update("trading_address", addr)}
          disabled={disabled}
        />

        {/* Contact details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input type="tel" value={data.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+44..." disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input value={data.website} onChange={(e) => update("website", e.target.value)} placeholder="https://..." disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label>Email <span className="text-destructive">*</span></Label>
            <Input type="email" value={data.contact_email} onChange={(e) => update("contact_email", e.target.value)} disabled={disabled} />
          </div>
        </div>

        {/* Optional extras */}
        <details className="group" open>
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Additional Information
          </summary>
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>VAT / Tax ID</Label>
                <Input value={data.vat_tax_id} onChange={(e) => update("vat_tax_id", e.target.value)} placeholder="VAT12345" disabled={disabled} />
              </div>
              <div className="space-y-2">
                <Label>Number of Employees</Label>
                <Input type="number" value={data.num_employees} onChange={(e) => update("num_employees", e.target.value)} placeholder="50" disabled={disabled} />
              </div>
              <div className="space-y-2">
                <Label>Last Full Financial Year Turnover</Label>
                <Input type="number" value={data.annual_turnover} onChange={(e) => update("annual_turnover", e.target.value)} placeholder="1000000" disabled={disabled} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>SIC Code(s)</Label>
              <Input value={data.sic_codes} onChange={(e) => update("sic_codes", e.target.value)} placeholder="e.g. 64992 – Factoring, 82920 – Packaging" disabled={disabled} />
            </div>

            {/* Group company */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={data.is_part_of_group}
                onChange={(e) => update("is_part_of_group", e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-input"
              />
              <Label className="font-normal">Part of a larger group?</Label>
            </div>

            {data.is_part_of_group && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name of the Parent Company</Label>
                  <Input value={data.parent_company_name} onChange={(e) => update("parent_company_name", e.target.value)} placeholder="Parent Corp Ltd" disabled={disabled} />
                </div>
                <div className="space-y-2">
                  <Label>% Shareholding of the Parent</Label>
                  <Input type="number" min="0" max="100" value={data.parent_shareholding_pct} onChange={(e) => update("parent_shareholding_pct", e.target.value)} placeholder="100" disabled={disabled} />
                </div>
              </div>
            )}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
