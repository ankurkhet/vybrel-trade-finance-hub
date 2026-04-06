import { Shield, ShieldAlert, ShieldX, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FraudBadgeProps {
  fraudStatus?: string | null;
  fraudScore?: number | null;
  reasons?: string[];
  compact?: boolean;
}

export function FraudBadge({ fraudStatus, fraudScore, reasons, compact = false }: FraudBadgeProps) {
  if (!fraudStatus || fraudStatus === "pending") {
    return compact ? null : (
      <Badge variant="outline" className="text-xs text-muted-foreground">
        <ShieldQuestion className="mr-1 h-3 w-3" />Pending
      </Badge>
    );
  }

  const config = {
    passed: {
      icon: Shield,
      label: "Clean",
      className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
    },
    flagged: {
      icon: ShieldAlert,
      label: "Flagged",
      className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    },
    blocked: {
      icon: ShieldX,
      label: "Blocked",
      className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
    },
    overridden: {
      icon: Shield,
      label: "Overridden",
      className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    },
  }[fraudStatus] || {
    icon: ShieldQuestion,
    label: fraudStatus,
    className: "",
  };

  const Icon = config.icon;

  const badge = (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
      {fraudScore != null && <span className="ml-1 opacity-75">({fraudScore})</span>}
    </Badge>
  );

  if (reasons && reasons.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <ul className="text-xs space-y-1">
              {reasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
