import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CalendarIcon, Check, ChevronsUpDown, Plus, Trash2, User, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AddressInput } from "./AddressInput";
import { COUNTRIES, emptyDirector } from "@/lib/onboarding-types";
import type { DirectorData } from "@/lib/onboarding-types";

interface DirectorsStepProps {
  directors: DirectorData[];
  onChange: (directors: DirectorData[]) => void;
  disabled?: boolean;
}

export function DirectorsStep({ directors, onChange, disabled }: DirectorsStepProps) {
  const [expanded, setExpanded] = useState<number | null>(directors.length > 0 ? 0 : null);

  const addDirector = () => {
    onChange([...directors, { ...emptyDirector }]);
    setExpanded(directors.length);
  };

  const removeDirector = (idx: number) => {
    const updated = directors.filter((_, i) => i !== idx);
    onChange(updated);
    if (expanded === idx) setExpanded(null);
    else if (expanded !== null && expanded > idx) setExpanded(expanded - 1);
  };

  const updateDirector = (idx: number, field: keyof DirectorData, value: any) => {
    const updated = [...directors];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Directors & Authorized Signatories
        </CardTitle>
        <CardDescription>Add all directors and/or authorized signatories for this company</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {directors.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <User className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No directors or signatories added yet</p>
          </div>
        )}

        {directors.map((dir, idx) => (
          <div key={idx} className="rounded-lg border">
            {/* Header */}
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-accent/50 transition-colors"
              onClick={() => setExpanded(expanded === idx ? null : idx)}
              disabled={disabled}
            >
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs capitalize">{dir.role.replace(/_/g, " ")}</Badge>
                <span className="font-medium text-sm text-foreground">
                  {dir.first_name || dir.last_name
                    ? `${dir.first_name} ${dir.last_name}`.trim()
                    : `Person ${idx + 1}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); removeDirector(idx); }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
                {expanded === idx ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {/* Expanded form */}
            {expanded === idx && (
              <div className="space-y-4 border-t px-4 py-4">
                {/* Role */}
                <div className="space-y-2">
                  <Label>Role <span className="text-destructive">*</span></Label>
                  <Select value={dir.role} onValueChange={(v) => updateDirector(idx, "role", v)} disabled={disabled}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="director">Director</SelectItem>
                      <SelectItem value="authorized_signatory">Authorised Signatory</SelectItem>
                      <SelectItem value="both">Director & Authorised Signatory</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Names */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>First Name <span className="text-destructive">*</span></Label>
                    <Input value={dir.first_name} onChange={(e) => updateDirector(idx, "first_name", e.target.value)} disabled={disabled} />
                  </div>
                  <div className="space-y-2">
                    <Label>Middle Name</Label>
                    <Input value={dir.middle_name} onChange={(e) => updateDirector(idx, "middle_name", e.target.value)} disabled={disabled} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name <span className="text-destructive">*</span></Label>
                    <Input value={dir.last_name} onChange={(e) => updateDirector(idx, "last_name", e.target.value)} disabled={disabled} />
                  </div>
                </div>

                {/* DOB + Nationality */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dir.date_of_birth && "text-muted-foreground")} disabled={disabled}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dir.date_of_birth ? format(new Date(dir.date_of_birth), "PPP") : "Select date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                         <Calendar
                          mode="single"
                          selected={dir.date_of_birth ? new Date(dir.date_of_birth) : undefined}
                          onSelect={(d) => updateDirector(idx, "date_of_birth", d ? d.toISOString().split("T")[0] : "")}
                          disabled={(d) => d > new Date()}
                          initialFocus
                          captionLayout="dropdown-buttons"
                          fromYear={1920}
                          toYear={new Date().getFullYear()}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Nationality</Label>
                    <NationalitySelect value={dir.nationality} onChange={(v) => updateDirector(idx, "nationality", v)} disabled={disabled} />
                  </div>
                </div>

                {/* Shareholding + Email + Phone */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {(dir.role === "director" || dir.role === "both") && (
                    <div className="space-y-2">
                      <Label>% Shareholding</Label>
                      <Input type="number" min="0" max="100" value={dir.shareholding_pct} onChange={(e) => updateDirector(idx, "shareholding_pct", e.target.value)} disabled={disabled} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={dir.email} onChange={(e) => updateDirector(idx, "email", e.target.value)} disabled={disabled} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input type="tel" value={dir.phone} onChange={(e) => updateDirector(idx, "phone", e.target.value)} disabled={disabled} />
                  </div>
                </div>

                {/* Residential Address */}
                <AddressInput
                  label="Residential Address"
                  value={dir.residential_address}
                  onChange={(addr) => updateDirector(idx, "residential_address", addr)}
                  disabled={disabled}
                />
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={addDirector} disabled={disabled}>
            <Plus className="mr-2 h-4 w-4" /> Add Director / Signatory
          </Button>
          {directors.length > 0 && (
            <Button type="button" variant="default" disabled={disabled} onClick={() => { /* save handled by parent */ }}>
              Save Directors
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NationalitySelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between" disabled={disabled}>
          {value ? COUNTRIES.find((c) => c.code === value)?.name || value : "Select..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>Not found.</CommandEmpty>
            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem key={c.code} value={c.name} onSelect={() => { onChange(c.code); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === c.code ? "opacity-100" : "opacity-0")} />
                  {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
