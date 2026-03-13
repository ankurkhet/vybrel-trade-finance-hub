import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, Brain, AlertTriangle, CheckCircle2, FileText } from "lucide-react";

interface AIInsightsDashboardProps {
  analysis: {
    id: string;
    type: string;
    status: string;
    source: string;
    risk_score: number;
    summary: string;
    created_at: string;
  };
  onClose: () => void;
}

export function AIInsightsDashboard({ analysis, onClose }: AIInsightsDashboardProps) {
  const getRiskColor = (score: number) => {
    if (score <= 25) return "text-[hsl(var(--success))]";
    if (score <= 50) return "text-[hsl(var(--warning))]";
    return "text-destructive";
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{analysis.source}</CardTitle>
            <CardDescription>
              AI Analysis • {new Date(analysis.created_at).toLocaleString()}
            </CardDescription>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Risk Score:</span>
            <span className={`text-2xl font-bold ${getRiskColor(analysis.risk_score)}`}>
              {analysis.risk_score}/100
            </span>
          </div>
          <Badge variant={analysis.risk_score <= 25 ? "secondary" : analysis.risk_score <= 50 ? "outline" : "destructive"}>
            {analysis.risk_score <= 25 ? "Low Risk" : analysis.risk_score <= 50 ? "Medium Risk" : "High Risk"}
          </Badge>
        </div>

        <Separator />

        <div>
          <h4 className="mb-2 font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" /> Summary
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
        </div>

        <Separator />

        <div>
          <h4 className="mb-2 font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Key Findings
          </h4>
          <div className="space-y-2">
            {analysis.summary.split(". ").map((finding, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[hsl(var(--success))]" />
                <span className="text-sm">{finding}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
