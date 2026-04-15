import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AutocompleteResult {
  company_name: string;
  registration_number: string;
  address_snippet: string;
  source: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelectCompany: (data: AutocompleteResult) => void;
  countryCode: string | undefined;
  disabled?: boolean;
}

export function CompanyAutocompleteInput({ value, onChange, onSelectCompany, countryCode, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!value || value.length < 2) {
      setResults([]);
      return;
    }
    if (!countryCode) return;
    
    if (!open) setOpen(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("registry-lookup", {
          body: { action: "autocomplete", company_name: value, country_code: countryCode }
        });
        if (!error && data?.results) {
          setResults(data.results);
        }
      } catch (err) {
        console.error("Autocomplete failed:", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, countryCode, open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
           <Input 
             value={value} 
             onChange={(e) => {
               onChange(e.target.value);
               if (!open && e.target.value.length >= 2) setOpen(true);
             }}
             onFocus={() => { if (value.length >= 2) setOpen(true); }}
             placeholder="e.g. Acme Corp Ltd" 
             disabled={disabled}
             className="pr-10"
           />
           {loading ? (
             <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
           ) : (
             <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground/50" />
           )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] max-w-[90vw] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command shouldFilter={false}>
          <CommandList>
            {!countryCode ? (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">Please select a Country first.</CommandEmpty>
            ) : loading ? (
              <CommandEmpty className="py-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                Searching live registry...
              </CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                No matching companies found.
              </CommandEmpty>
            ) : (
              <CommandGroup heading="Live Registry Results">
                {results.map((r, i) => (
                  <CommandItem
                    key={`${r.registration_number}-${i}`}
                    value={r.company_name}
                    onSelect={() => {
                      onSelectCompany(r);
                      setOpen(false);
                      // Let the input momentarily lose focus or stay focused depending on flow, but we are done.
                    }}
                    className="flex flex-col items-start py-3 cursor-pointer border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      {r.company_name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5 xl:ml-6">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{r.registration_number || "N/A"}</span>
                      <span className="truncate max-w-[240px]">{r.address_snippet}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
