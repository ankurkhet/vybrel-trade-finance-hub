import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, User, ChevronDown, ChevronUp, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddressInput } from "./AddressInput";
import { DateInput } from "@/components/ui/date-input";
import { NationalitySelect } from "./NationalitySelect";
import { emptyDirector } from "@/lib/onboarding-types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DirectorData } from "@/lib/onboarding-types";

interface DirectorsStepProps {
  directors: DirectorData[];
  onChange: (directors: DirectorData[]) => void;
  disabled?: boolean;
  borrowerId?: string;
  organizationId?: string;
}

export function DirectorsStep({ directors, onChange, disabled, borrowerId, organizationId }: DirectorsStepProps) {
  const [expanded, setExpanded] = useState<number | null>(directors.length > 0 ? 0 : null);
  const [screeningResults, setScreeningResults] = useState<Record<number, { status: string; message: string } | null>>({});
  const [screeningLoading, setScreeningLoading] = useState<Record<number, boolean>>({});

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

  const runSanctionsScreening = async (idx: number) => {
    const dir = directors[idx];
    if (!dir.first_name || !dir.last_name) {
      toast.error("First and last name are required for screening");
      return;
    }

    setScreeningLoading(prev => ({ ...prev, [idx]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("registry-lookup", {
        body: {
          action: "sanctions_check",
          query: `${dir.first_name} ${dir.middle_name || ""} ${dir.last_name}`.trim(),
          country: dir.nationality || "GB",
        },
      });

      if (error) throw error;

      const isClean = !data?.results || data.results.length === 0;
      setScreeningResults(prev => ({
        ...prev,
        [idx]: {
          status: isClean ? "clear" : "flagged",
          message: isClean
            ? "No sanctions or PEP matches found"
            : `${data.results.length} potential match(es) found — review required`,
        },
      }));

      if (isClean) {
        toast.success(`${dir.first_name} ${dir.last_name}: Sanctions screening clear`);
      } else {
        toast.warning(`${dir.first_name} ${dir.last_name}: ${data.results.length} potential match(es) — review required`);
      }
    } catch (err: any) {
      setScreeningResults(prev => ({
        ...prev,
        [idx]: { status: "error", message: err.message || "Screening failed" },
      }));
      toast.error("Sanctions screening failed: " + (err.message || "Unknown error"));
    } finally {
      setScreeningLoading(prev => ({ ...prev, [idx]: false }));
    }
  };

  const handleSaveDirector = async (idx: number) => {
    const dir = directors[idx];
    if (!dir.first_name || !dir.last_name) {
      toast.error("First and last name are required");
      return;
    }

    // Auto-trigger sanctions screening on save
    await runSanctionsScreening(idx);
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
                {screeningResults[idx] && (
                  screeningResults[idx]!.status === "clear"
                    ? <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200"><ShieldCheck className="h-3 w-3 mr-1" />Clear</Badge>
                    : screeningResults[idx]!.status === "flagged"
                      ? <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"><ShieldAlert className="h-3 w-3 mr-1" />Review</Badge>
                      : null
                )}
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

            {expanded === idx && (
              <div className="space-y-4 border-t px-4 py-4">
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <DateInput
                      value={dir.date_of_birth}
                      onChange={(v) => updateDirector(idx, "date_of_birth", v)}
                      disabled={disabled}
                      maxToday
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nationality</Label>
                    <NationalitySelect value={dir.nationality} onChange={(v) => updateDirector(idx, "nationality", v)} disabled={disabled} />
                  </div>
                </div>

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

                <AddressInput
                  label="Residential Address"
                  value={dir.residential_address}
                  onChange={(addr) => updateDirector(idx, "residential_address", addr)}
                  disabled={disabled}
                />

                {screeningResults[idx] && (
                  <div className={cn(
                    "rounded-md border p-3 text-sm",
                    screeningResults[idx]!.status === "clear" && "bg-green-50 border-green-200 text-green-800",
                    screeningResults[idx]!.status === "flagged" && "bg-amber-50 border-amber-200 text-amber-800",
                    screeningResults[idx]!.status === "error" && "bg-red-50 border-red-200 text-red-800",
                  )}>
                    {screeningResults[idx]!.message}
                  </div>
                )}

                {!disabled && (
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => runSanctionsScreening(idx)}
                      disabled={screeningLoading[idx]}
                    >
                      {screeningLoading[idx] ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-2 h-3 w-3" />}
                      Screen
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => handleSaveDirector(idx)}
                      disabled={screeningLoading[idx]}
                    >
                      {screeningLoading[idx] && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                      Save & Screen
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={addDirector} disabled={disabled}>
            <Plus className="mr-2 h-4 w-4" /> Add Director / Signatory
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
