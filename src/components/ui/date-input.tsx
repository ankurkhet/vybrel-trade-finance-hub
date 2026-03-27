import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateInputProps {
  value: string; // ISO date string (YYYY-MM-DD) or empty
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Disable dates after today */
  maxToday?: boolean;
  fromYear?: number;
  toYear?: number;
}

export function DateInput({
  value,
  onChange,
  disabled,
  placeholder = "DD/MM/YYYY",
  className,
  maxToday = false,
  fromYear = 1920,
  toYear,
}: DateInputProps) {
  const [textValue, setTextValue] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const currentToYear = toYear || new Date().getFullYear();

  // Sync text value from ISO value
  React.useEffect(() => {
    if (value) {
      try {
        const d = new Date(value);
        if (isValid(d)) {
          setTextValue(format(d, "dd/MM/yyyy"));
          return;
        }
      } catch {}
    }
    setTextValue("");
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;
    // Auto-insert slashes
    const digits = raw.replace(/\D/g, "");
    if (digits.length <= 2) {
      raw = digits;
    } else if (digits.length <= 4) {
      raw = digits.slice(0, 2) + "/" + digits.slice(2);
    } else {
      raw = digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4, 8);
    }
    setTextValue(raw);

    // Try parsing complete date
    if (raw.length === 10) {
      const parsed = parse(raw, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        const iso = format(parsed, "yyyy-MM-dd");
        if (maxToday && parsed > new Date()) return;
        onChange(iso);
      }
    }
  };

  const handleBlur = () => {
    if (textValue && textValue.length === 10) {
      const parsed = parse(textValue, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        onChange(format(parsed, "yyyy-MM-dd"));
      }
    } else if (!textValue) {
      onChange("");
    }
  };

  const selectedDate = value ? new Date(value) : undefined;

  return (
    <div className={cn("flex gap-2", className)}>
      <Input
        value={textValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
        maxLength={10}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            disabled={disabled}
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => {
              if (d) {
                onChange(format(d, "yyyy-MM-dd"));
              } else {
                onChange("");
              }
              setOpen(false);
            }}
            disabled={maxToday ? (d) => d > new Date() : undefined}
            initialFocus
            captionLayout="dropdown-buttons"
            fromYear={fromYear}
            toYear={currentToYear}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
