import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  Download,
  RefreshCw,
  ChevronDown,
  Shield,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_CATEGORIES: Record<string, { label: string; color: string }> = {
  auth: { label: "Auth", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  data: { label: "Data", color: "bg-muted text-muted-foreground" },
  financial: { label: "Financial", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  compliance: { label: "Compliance", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  admin: { label: "Admin", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

const DATE_RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const PAGE_SIZE = 25;

function getCategory(action: string): string {
  const prefix = action.split(".")[0];
  return ACTION_CATEGORIES[prefix] ? prefix : "data";
}

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getDateFilter(range: string): string | null {
  const now = new Date();
  switch (range) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 86400000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 86400000).toISOString();
    case "90d":
      return new Date(now.getTime() - 90 * 86400000).toISOString();
    default:
      return null;
  }
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("30d");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const dateFrom = getDateFilter(dateRange);
      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }

      if (category !== "all") {
        query = query.like("action", `${category}.%`);
      }

      if (search.trim()) {
        query = query.or(
          `user_email.ilike.%${search}%,action.ilike.%${search}%,resource_type.ilike.%${search}%,resource_id.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      setLogs((data as AuditLog[]) || []);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (err: any) {
      toast.error("Failed to load audit logs", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [page, dateRange, category, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(0);
  }, [dateRange, category, search]);

  const exportCSV = () => {
    if (logs.length === 0) return;
    const headers = ["Timestamp", "User Email", "Action", "Resource Type", "Resource ID", "Details"];
    const rows = logs.map((l) => [
      formatTimestamp(l.created_at),
      l.user_email || "",
      l.action,
      l.resource_type,
      l.resource_id || "",
      JSON.stringify(l.details),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Audit logs exported");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-muted-foreground">
              Track all platform activity and user actions
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={logs.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by email, action, resource..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[160px]">
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[160px]">
                  <Shield className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(ACTION_CATEGORIES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Activity Log {!loading && `(${logs.length}${hasMore ? "+" : ""} entries)`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && logs.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Loading audit logs...
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Shield className="mb-3 h-10 w-10 opacity-40" />
                <p className="font-medium">No audit logs found</p>
                <p className="text-sm">
                  Adjust your filters or wait for activity to be recorded.
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const cat = getCategory(log.action);
                      const catInfo = ACTION_CATEGORIES[cat];
                      const isExpanded = expandedRow === log.id;
                      return (
                        <Collapsible key={log.id} open={isExpanded} asChild>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow
                                className="cursor-pointer"
                                onClick={() =>
                                  setExpandedRow(isExpanded ? null : log.id)
                                }
                              >
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {formatTimestamp(log.created_at)}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {log.user_email || "System"}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className={catInfo?.color || ""}
                                  >
                                    {log.action}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">
                                  <span className="text-muted-foreground">
                                    {log.resource_type}
                                  </span>
                                  {log.resource_id && (
                                    <span className="ml-1 font-mono text-xs">
                                      #{log.resource_id.slice(0, 8)}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <ChevronDown
                                    className={`h-4 w-4 transition-transform ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                  />
                                </TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                              <tr>
                                <td colSpan={5} className="bg-muted/30 px-6 py-4">
                                  <div className="grid gap-2 text-sm md:grid-cols-2">
                                    <div>
                                      <span className="font-medium text-muted-foreground">
                                        User ID:{" "}
                                      </span>
                                      <span className="font-mono text-xs">
                                        {log.user_id || "N/A"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-medium text-muted-foreground">
                                        Resource ID:{" "}
                                      </span>
                                      <span className="font-mono text-xs">
                                        {log.resource_id || "N/A"}
                                      </span>
                                    </div>
                                    <div className="md:col-span-2">
                                      <span className="font-medium text-muted-foreground">
                                        User Agent:{" "}
                                      </span>
                                      <span className="text-xs">
                                        {log.user_agent
                                          ? log.user_agent.slice(0, 120)
                                          : "N/A"}
                                      </span>
                                    </div>
                                    {log.details &&
                                      Object.keys(log.details).length > 0 && (
                                        <div className="md:col-span-2">
                                          <span className="font-medium text-muted-foreground">
                                            Details:
                                          </span>
                                          <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                                            {JSON.stringify(log.details, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                  </div>
                                </td>
                              </tr>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={!hasMore}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
