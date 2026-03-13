import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportButton } from "./ExportButton";
import { Calendar, RefreshCw } from "lucide-react";

interface ReportPageProps {
  title: string;
  description?: string;
  children: ReactNode;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  onRefresh?: () => void;
}

export function ReportPage({ title, description, children, onExportCSV, onExportPDF, onRefresh }: ReportPageProps) {
  const [dateRange, setDateRange] = useState("30d");

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === "custom" && (
            <div className="flex gap-2">
              <Input type="date" className="w-auto" />
              <Input type="date" className="w-auto" />
            </div>
          )}

          {onRefresh && (
            <Button variant="outline" size="icon" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}

          {onExportCSV && <ExportButton onExportCSV={onExportCSV} onExportPDF={onExportPDF} />}
        </div>
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
