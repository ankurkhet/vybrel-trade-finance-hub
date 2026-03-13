import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AIInsightsBadge } from "@/components/ai/AIInsightsBadge";
import { AIInsightsDashboard } from "@/components/ai/AIInsightsDashboard";
import {
  Brain,
  FileText,
  FileCheck,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "lucide-react";

// Mock data for demonstration
const mockAnalyses = [
  {
    id: "1",
    type: "document_analysis",
    status: "completed",
    source: "KYC - Acme Corp",
    risk_score: 15,
    summary: "All KYC documents verified. Company registration valid. No red flags detected.",
    created_at: "2026-03-12T10:00:00Z",
  },
  {
    id: "2",
    type: "contract_review",
    status: "completed",
    source: "Supply Agreement - GlobalTrade",
    risk_score: 45,
    summary: "Contract missing force majeure clause. Payment terms 90 days - extended risk. Recommend advance rate of 75%.",
    created_at: "2026-03-12T14:00:00Z",
  },
  {
    id: "3",
    type: "invoice_contract_match",
    status: "completed",
    source: "INV-2026-001 vs Supply Agreement",
    risk_score: 20,
    summary: "Invoice matches contract counterparty and is within contract limits. Due date within contract period. Match score: 88%.",
    created_at: "2026-03-13T09:00:00Z",
  },
  {
    id: "4",
    type: "credit_memo",
    status: "completed",
    source: "Credit Memo - Acme Corp",
    risk_score: 30,
    summary: "Recommend approval with conditions. Suggested limit: $500K at 80% advance rate. Key risks: concentration on single debtor.",
    created_at: "2026-03-13T11:00:00Z",
  },
];

export default function AIInsightsPage() {
  const [selectedAnalysis, setSelectedAnalysis] = useState<typeof mockAnalyses[0] | null>(null);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "document_analysis": return FileText;
      case "contract_review": return FileCheck;
      case "invoice_contract_match": return CreditCard;
      case "credit_memo": return Brain;
      default: return FileText;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "document_analysis": return "Document Analysis";
      case "contract_review": return "Contract Review";
      case "invoice_contract_match": return "Invoice Match";
      case "credit_memo": return "Credit Memo";
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"><CheckCircle2 className="mr-1 h-3 w-3" />Complete</Badge>;
      case "processing":
        return <Badge variant="secondary"><RefreshCw className="mr-1 h-3 w-3 animate-spin" />Processing</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Failed</Badge>;
      default:
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
    }
  };

  const getRiskBadge = (score: number) => {
    if (score <= 25) return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Low ({score})</Badge>;
    if (score <= 50) return <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]">Medium ({score})</Badge>;
    if (score <= 75) return <Badge variant="destructive">High ({score})</Badge>;
    return <Badge variant="destructive">Critical ({score})</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              AI Insights
            </h1>
            <p className="text-muted-foreground">AI-powered analysis of documents, contracts, and invoices</p>
          </div>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Analyses</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="invoices">Invoice Matching</TabsTrigger>
            <TabsTrigger value="memos">Credit Memos</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Analyses</CardTitle>
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockAnalyses.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Risk Score</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(mockAnalyses.reduce((sum, a) => sum + a.risk_score, 0) / mockAnalyses.length)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Items</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockAnalyses.filter(a => a.risk_score > 50).length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockAnalyses.filter(a => a.status === "completed").length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Analyses Table */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Analyses</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockAnalyses.map((analysis) => {
                      const Icon = getTypeIcon(analysis.type);
                      return (
                        <TableRow key={analysis.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-primary" />
                              <span className="text-sm">{getTypeLabel(analysis.type)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{analysis.source}</TableCell>
                          <TableCell>{getStatusBadge(analysis.status)}</TableCell>
                          <TableCell>{getRiskBadge(analysis.risk_score)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(analysis.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedAnalysis(analysis)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {["documents", "contracts", "invoices", "memos"].map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardHeader>
                  <CardTitle>{tab === "memos" ? "Credit Memo" : tab.charAt(0).toUpperCase() + tab.slice(1)} Analyses</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Filtered view coming soon — see All Analyses tab</p>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Detail Panel */}
        {selectedAnalysis && (
          <AIInsightsDashboard
            analysis={selectedAnalysis}
            onClose={() => setSelectedAnalysis(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
