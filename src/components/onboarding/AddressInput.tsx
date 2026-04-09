import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Search, X, Loader2 } from "lucide-react";
import type { AddressData } from "@/lib/onboarding-types";
import { supabase } from "@/integrations/supabase/client";

interface AddressInputProps {
  value: AddressData;
  onChange: (address: AddressData) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  countryCode?: string; // ISO-2 country code to scope results (e.g. "GB")
}

interface AddressSuggestion {
  displayName: string;
  line1: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  raw?: any;
}

// ─── Active address provider lookup (reads from registry_api_configs) ─────────
async function fetchAddressSuggestions(query: string, countryCode?: string): Promise<AddressSuggestion[]> {
  // Discover the active address-lookup provider from registry_api_configs.
  // This lets the Vybrel Admin switch providers without code changes.
  const { data: configs } = await supabase
    .from("registry_api_configs")
    .select("registry_name, api_base_url, api_key_value, capabilities, is_active")
    .contains("capabilities", ["address_lookup"])
    .eq("is_active", true)
    .limit(1);

  const provider = configs?.[0];

  if (!provider) {
    // Fallback to Photon (free, no key required) if no provider configured
    return fetchPhoton(query, countryCode);
  }

  const name = (provider.registry_name || "").toLowerCase();

  if (name.includes("google")) {
    return fetchGoogle(query, countryCode, provider.api_key_value);
  }
  if (name.includes("loqate")) {
    return fetchLoqate(query, countryCode, provider.api_key_value, provider.api_base_url);
  }
  // Default: Photon
  return fetchPhoton(query, countryCode);
}

// ─── Photon (OpenStreetMap) ───────────────────────────────────────────────────
async function fetchPhoton(query: string, countryCode?: string): Promise<AddressSuggestion[]> {
  const countryParam = countryCode ? `&layer=address&countrycodes=${countryCode.toLowerCase()}` : "";
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6${countryParam}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features || []).map((f: any) => {
    const p = f.properties;
    const parts: string[] = [];
    if (p.housenumber && p.street) parts.push(`${p.housenumber} ${p.street}`);
    else if (p.street) parts.push(p.street);
    else if (p.name) parts.push(p.name);
    if (p.city || p.district) parts.push(p.city || p.district);
    if (p.state) parts.push(p.state);
    if (p.postcode) parts.push(p.postcode);
    if (p.country) parts.push(p.country);
    const line1Parts: string[] = [];
    if (p.housenumber) line1Parts.push(p.housenumber);
    if (p.street) line1Parts.push(p.street);
    if (!line1Parts.length && p.name) line1Parts.push(p.name);
    return {
      displayName: parts.join(", "),
      line1: line1Parts.join(" "),
      city: p.city || p.district || "",
      state: p.state || "",
      postal_code: p.postcode || "",
      country: p.country || "",
      raw: f,
    };
  });
}

// ─── Google Places ────────────────────────────────────────────────────────────
async function fetchGoogle(query: string, countryCode: string | undefined, apiKey: string): Promise<AddressSuggestion[]> {
  if (!apiKey) return fetchPhoton(query, countryCode); // fallback if key missing
  const components = countryCode ? `&components=country:${countryCode.toUpperCase()}` : "";
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}${components}&key=${apiKey}&language=en&result_type=street_address|locality`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).slice(0, 6).map((r: any) => {
    const getComponent = (type: string) =>
      r.address_components?.find((c: any) => c.types.includes(type))?.long_name || "";
    return {
      displayName: r.formatted_address,
      line1: [getComponent("street_number"), getComponent("route")].filter(Boolean).join(" "),
      city: getComponent("locality") || getComponent("postal_town"),
      state: getComponent("administrative_area_level_1"),
      postal_code: getComponent("postal_code"),
      country: getComponent("country"),
      raw: r,
    };
  });
}

// ─── Loqate ───────────────────────────────────────────────────────────────────
async function fetchLoqate(query: string, countryCode: string | undefined, apiKey: string, baseUrl?: string): Promise<AddressSuggestion[]> {
  if (!apiKey) return fetchPhoton(query, countryCode); // fallback
  const base = baseUrl || "https://api.addressy.com/Capture/Interactive/Find/v1.10/json3.ws";
  const country = countryCode?.toUpperCase() || "";
  const res = await fetch(
    `${base}?Key=${apiKey}&Text=${encodeURIComponent(query)}&Countries=${country}&IsMiddleware=False&Limit=6&Language=en`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.Items || [])
    .filter((item: any) => item.Type !== "Container")
    .map((item: any) => ({
      displayName: [item.Text, item.Description].filter(Boolean).join(", "),
      line1: item.Text || "",
      city: item.Description?.split(",")[0]?.trim() || "",
      state: "",
      postal_code: "",
      country: countryCode || "",
      raw: item,
    }));
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AddressInput({ value, onChange, label, required, disabled, countryCode }: AddressInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
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
      const results = await fetchAddressSuggestions(query, countryCode);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch {
      setSuggestions([]);
    }
    setSearching(false);
  }, [countryCode]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(val), 350);
  };

  const selectSuggestion = (s: AddressSuggestion) => {
    onChange({
      line1: s.line1,
      line2: "",
      city: s.city,
      state: s.state,
      postal_code: s.postal_code,
      country: s.country,
    });
    setSearchQuery(s.displayName);
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

      {/* Dynamic provider search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={countryCode ? `Start typing an address (${countryCode})...` : "Start typing an address..."}
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
                key={i}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                onClick={() => selectSuggestion(s)}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="text-foreground">{s.displayName}</span>
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