import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const SUPPORTED_CURRENCIES = [
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]["code"];

interface CurrencyInputProps {
  value: string | number;
  currency: CurrencyCode;
  onValueChange: (value: string) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CurrencyInput({
  value,
  currency,
  onValueChange,
  onCurrencyChange,
  placeholder = "0.00",
  disabled,
  className,
}: CurrencyInputProps) {
  const symbol = SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol || "£";

  return (
    <div className={`flex gap-2 ${className || ""}`}>
      <Select value={currency} onValueChange={(v) => onCurrencyChange(v as CurrencyCode)} disabled={disabled}>
        <SelectTrigger className="w-[90px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_CURRENCIES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.symbol} {c.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
}

export function formatCurrency(amount: number, currency: CurrencyCode = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
