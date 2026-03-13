import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Brain, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface AIInsightsBadgeProps {
  type: "document" | "contract" | "invoice" | "memo";
  status: "pending" | "processing" | "completed" | "failed";
  riskScore?: number;
  summary?: string;
}

export function AIInsightsBadge({ type, status, riskScore, summary }: AIInsightsBadgeProps) {
  if (status === "pending") return null;

  const getRiskColor = () => {
    if (!riskScore) return "secondary";
    if (riskScore <= 25) return "default";
    if (riskScore <= 50) return "secondary";
    return "destructive";
  };

  const getIcon = () => {
    if (status === "processing") return <Brain className="h-3 w-3 animate-pulse" />;
    if (status === "failed") return <XCircle className="h-3 w-3" />;
    if (riskScore && riskScore > 50) return <AlertTriangle className="h-3 w-3" />;
    return <CheckCircle2 className="h-3 w-3" />;
  };

  const getLabel = () => {
    if (status === "processing") return "AI Analyzing...";
    if (status === "failed") return "Analysis Failed";
    if (riskScore !== undefined) return `Risk: ${riskScore}`;
    return "Analyzed";
  };

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant={getRiskColor() as any} className="gap-1 text-xs">
          {getIcon()}
          {getLabel()}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-sm">{summary || `AI ${type} analysis ${status}`}</p>
      </TooltipContent>
    </Tooltip>
  );
}
