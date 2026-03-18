import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Search, X } from "lucide-react";
import type { AddressData } from "@/lib/onboarding-types";

interface AddressInputProps {
  value: AddressData;
  onChange: (address: AddressData) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
}

export function AddressInput({ value, onChange, label, required, disabled }: AddressInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchAddress = useCallback(
    async (query: string) => {
      if (!mapboxToken || query.length < 3) {
        setSuggestions([]);
        return;
      }
      setSearching(true);
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&types=address,place&limit=5`
        );
        const data = await res.json();
        setSuggestions(data.features || []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      }
      setSearching(false);
    },
    [mapboxToken]
  );

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(val), 350);
  };

  const selectSuggestion = (feature: any) => {
    const context = feature.context || [];
    const getCtx = (type: string) => context.find((c: any) => c.id.startsWith(type))?.text || "";

    onChange({
      line1: feature.place_name?.split(",")[0] || feature.text || "",
      line2: "",
      city: getCtx("place") || getCtx("locality"),
      state: getCtx("region"),
      postal_code: getCtx("postcode"),
      country: getCtx("country"),
    });
    setSearchQuery(feature.place_name || "");
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

      {/* Search bar - only show if Mapbox token is set */}
      {mapboxToken && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Start typing an address..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-8"
            disabled={disabled}
          />
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
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg">
              {suggestions.map((s: any) => (
                <button
                  type="button"
                  key={s.id}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                  onClick={() => selectSuggestion(s)}
                >
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-foreground">{s.place_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Always show manual fields if no Mapbox, or toggled, or has value */}
      {(!mapboxToken || showManual || hasValue) && (
        <div className="grid gap-3">
          <Input placeholder="Address line 1" value={value.line1} onChange={(e) => updateField("line1", e.target.value)} disabled={disabled} />
          <Input placeholder="Address line 2 (optional)" value={value.line2} onChange={(e) => updateField("line2", e.target.value)} disabled={disabled} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="City" value={value.city} onChange={(e) => updateField("city", e.target.value)} disabled={disabled} />
            <Input placeholder="State / Region" value={value.state} onChange={(e) => updateField("state", e.target.value)} disabled={disabled} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Postal / ZIP code" value={value.postal_code} onChange={(e) => updateField("postal_code", e.target.value)} disabled={disabled} />
            <Input placeholder="Country" value={value.country} onChange={(e) => updateField("country", e.target.value)} disabled={disabled} />
          </div>
        </div>
      )}
    </div>
  );
}
