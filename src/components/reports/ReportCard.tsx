import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ReportCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  icon?: LucideIcon;
  className?: string;
}

export function ReportCard({ title, value, subtitle, change, icon: Icon, className }: ReportCardProps) {
  const TrendIcon = change && change > 0 ? TrendingUp : change && change < 0 ? TrendingDown : Minus;
  const trendColor = change && change > 0 ? "text-success" : change && change < 0 ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className={cn("animate-fade-in", className)}>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground md:text-3xl">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {Icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
            )}
            {change !== undefined && (
              <div className={cn("flex items-center gap-1 text-sm font-medium", trendColor)}>
                <TrendIcon className="h-3.5 w-3.5" />
                <span>{Math.abs(change)}%</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
