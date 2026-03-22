import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Search, X, Loader2 } from "lucide-react";
import type { AddressData } from "@/lib/onboarding-types";

interface AddressInputProps {
  value: AddressData;
  onChange: (address: AddressData) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
}

interface PhotonFeature {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    district?: string;
    locality?: string;
    type?: string;
  };
}

export function AddressInput({ value, onChange, label, required, disabled }: AddressInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setSearching(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/address-lookup?q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await res.json();
      setSuggestions((data.features as PhotonFeature[]) || []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
    setSearching(false);
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(val), 350);
  };

  const formatDisplayName = (props: PhotonFeature["properties"]) => {
    const parts: string[] = [];
    if (props.housenumber && props.street) parts.push(`${props.housenumber} ${props.street}`);
    else if (props.street) parts.push(props.street);
    else if (props.name) parts.push(props.name);
    if (props.city) parts.push(props.city);
    if (props.state) parts.push(props.state);
    if (props.postcode) parts.push(props.postcode);
    if (props.country) parts.push(props.country);
    return parts.join(", ");
  };

  const selectSuggestion = (feature: PhotonFeature) => {
    const p = feature.properties;
    const line1Parts: string[] = [];
    if (p.housenumber) line1Parts.push(p.housenumber);
    if (p.street) line1Parts.push(p.street);
    if (!line1Parts.length && p.name) line1Parts.push(p.name);

    onChange({
      line1: line1Parts.join(" "),
      line2: "",
      city: p.city || p.district || "",
      state: p.state || "",
      postal_code: p.postcode || "",
      country: p.country || "",
    });
    setSearchQuery(formatDisplayName(p));
    setShowSuggestions(false);
    setShowManual(true);
  };

  const updateField = (field: keyof AddressData, val: string) => {
    onChange({ ...value, [field]: val });
  };

  const hasValue = value.line1 || value.city;

  return (
    <div className="space-y-3" ref={wrapperRef}>
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => setShowManual(!showManual)}
          disabled={disabled}
        >
          {showManual ? "Hide fields" : "Enter manually"}
        </Button>
      </div>

      {/* Photon search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Start typing an address..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 pr-8"
          disabled={disabled}
        />
        {searching && (
          <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {searchQuery && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2"
            onClick={() => {
              setSearchQuery("");
              setSuggestions([]);
            }}
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                type="button"
                key={s.properties.osm_id ?? i}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                onClick={() => selectSuggestion(s)}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-foreground">{formatDisplayName(s.properties)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Manual fields — show if toggled, or has value */}
      {(showManual || hasValue) && (
        <div className="grid gap-3">
          <Input placeholder="Address line 1" value={value.line1} onChange={(e) => updateField("line1", e.target.value)} disabled={disabled} />
          <Input placeholder="Address line 2 (optional)" value={value.line2} onChange={(e) => updateField("line2", e.target.value)} disabled={disabled} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="City" value={value.city} onChange={(e) => updateField("city", e.target.value)} disabled={disabled} />
            <Input placeholder="State / Region" value={value.state} onChange={(e) => updateField("state", e.target.value)} disabled={disabled} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Postcode / ZIP / PIN</Label>
              <Input placeholder="e.g. SW1A 1AA" value={value.postal_code} onChange={(e) => updateField("postal_code", e.target.value)} disabled={disabled} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Country</Label>
              <Input placeholder="Country" value={value.country} onChange={(e) => updateField("country", e.target.value)} disabled={disabled} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}