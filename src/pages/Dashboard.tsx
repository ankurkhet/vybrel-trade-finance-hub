import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2, Users, FileText, Brain, CreditCard, Upload, BarChart3, Shield,
  Receipt, Settings2, Table as TableIcon, BarChart2, Eye, EyeOff, Search
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ActorWalletCard } from "@/components/ledger/ActorWalletCard";

// ─── Widget definitions per role ────────────────────────────────────────────

interface WidgetDef {
  id: string;
  title: string;
  icon: any;
  subtitle: string;
  role: string; // which role group this belongs to
  navigateTo?: string;
  supportsChart?: boolean;
}

const ALL_WIDGETS: WidgetDef[] = [
  // Admin
  { id: "admin_orgs", title: "Organizations", icon: Building2, subtitle: "Active originators", role: "admin", navigateTo: "/admin/organizations", supportsChart: true },
  { id: "admin_users", title: "Total Users", icon: Users, subtitle: "Across all orgs", role: "admin", navigateTo: "/admin/users", supportsChart: true },
  { id: "admin_pending", title: "Pending Reviews", icon: FileText, subtitle: "Documents awaiting review", role: "admin", navigateTo: "/admin/organizations", supportsChart: false },
  { id: "admin_ai", title: "AI Analyses", icon: Brain, subtitle: "Completed", role: "admin", supportsChart: true },
  // Originator / Broker
  { id: "orig_borrowers", title: "Borrowers", icon: Users, subtitle: "Active borrowers", role: "originator", navigateTo: "/originator/borrowers", supportsChart: true },
  { id: "orig_counterparties", title: "Counterparties", icon: Building2, subtitle: "Linked counterparties", role: "originator", navigateTo: "/originator/counterparties", supportsChart: false },
  { id: "orig_contracts", title: "Contracts", icon: FileText, subtitle: "Active contracts", role: "originator", navigateTo: "/originator/contracts", supportsChart: true },
  { id: "orig_invoices", title: "Invoices", icon: CreditCard, subtitle: "Pending invoices", role: "originator", navigateTo: "/originator/invoices", supportsChart: true },
  { id: "orig_limits", title: "Total Limits", icon: Shield, subtitle: "Aggregate credit limits", role: "originator", supportsChart: false },
  { id: "orig_outstanding", title: "Total Outstanding", icon: Receipt, subtitle: "Unpaid invoices", role: "originator", supportsChart: false },
  { id: "orig_overdue", title: "Total Overdue", icon: BarChart3, subtitle: "Past due date", role: "originator", supportsChart: true },
  { id: "orig_memos", title: "Credit Memos", icon: Brain, subtitle: "Drafts pending review", role: "originator", supportsChart: false },
  // Borrower
  { id: "borr_docs", title: "Documents", icon: Upload, subtitle: "Uploaded documents", role: "borrower", navigateTo: "/borrower/documents", supportsChart: false },
  { id: "borr_invoices", title: "Invoices", icon: CreditCard, subtitle: "Submitted invoices", role: "borrower", navigateTo: "/borrower/invoices", supportsChart: true },
  { id: "borr_credit", title: "Credit Limit", icon: BarChart3, subtitle: "Available facility limit", role: "borrower", supportsChart: false },
  { id: "borr_rates", title: "My Rates", icon: Receipt, subtitle: "Discounting · Advance · Overdue", role: "borrower", navigateTo: "/borrower/offer-letters", supportsChart: false },
  // Funder
  { id: "fund_portfolio", title: "Portfolio", icon: BarChart3, subtitle: "Total exposure", role: "funder", navigateTo: "/funder/portfolio", supportsChart: true },
  { id: "fund_deals", title: "Active Deals", icon: Shield, subtitle: "Funded deals", role: "funder", navigateTo: "/funder/portfolio", supportsChart: false },
  { id: "fund_market", title: "Marketplace", icon: CreditCard, subtitle: "View available invoices", role: "funder", navigateTo: "/funder/marketplace", supportsChart: false },
];

interface WidgetConfig {
  [widgetId: string]: { visible: boolean; viewMode: "card" | "chart" | "table" };
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(217, 91%, 60%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
];

// ─── Main Dashboard ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, profile, roles, isAdmin, isOriginatorAdmin, isBorrower, isFunder, isBroker } = useAuth();
  const navigate = useNavigate();
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>({});
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [stats, setStats] = useState<Record<string, { value: string; loading: boolean; chartData?: any[] }>>({});

  // Determine which role groups are relevant
  const activeRoles: string[] = [];
  if (isAdmin) activeRoles.push("admin");
  if (isOriginatorAdmin || isBroker) activeRoles.push("originator");
  if (isBorrower) activeRoles.push("borrower");
  if (isFunder) activeRoles.push("funder");

  const relevantWidgets = ALL_WIDGETS.filter((w) => activeRoles.includes(w.role));

  // ── Load preferences ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("dashboard_preferences")
      .select("widget_config")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.widget_config) {
          setWidgetConfig(data.widget_config as unknown as WidgetConfig);
        }
        setPrefsLoaded(true);
      });
  }, [user?.id]);

  // ── Save preferences ──────────────────────────────────────────────────────

  const savePrefs = useCallback(
    async (config: WidgetConfig) => {
      if (!user?.id) return;
      const { data: existing } = await supabase
        .from("dashboard_preferences")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("dashboard_preferences")
          .update({ widget_config: JSON.parse(JSON.stringify(config)) })
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("dashboard_preferences")
          .insert([{ user_id: user.id, widget_config: JSON.parse(JSON.stringify(config)) }]);
      }
    },
    [user?.id]
  );

  const updateWidget = (id: string, patch: Partial<{ visible: boolean; viewMode: "card" | "chart" | "table" }>) => {
    setWidgetConfig((prev) => {
      const next = { ...prev, [id]: { visible: true, viewMode: "card" as const, ...prev[id], ...patch } };
      savePrefs(next);
      return next;
    });
  };

  const isVisible = (id: string) => widgetConfig[id]?.visible !== false;
  const getViewMode = (id: string) => widgetConfig[id]?.viewMode || "card";

  // ── Fetch stats ───────────────────────────────────────────────────────────

  const basePath = isBroker ? "/broker" : "/originator";

  useEffect(() => {
    const s: Record<string, { value: string; loading: boolean; chartData?: any[] }> = {};
    const set = (id: string, value: string, chartData?: any[]) => {
      s[id] = { value, loading: false, chartData };
      setStats((prev) => ({ ...prev, [id]: { value, loading: false, chartData } }));
    };

    // Init all as loading
    relevantWidgets.forEach((w) => {
      s[w.id] = { value: "—", loading: true };
    });
    setStats({ ...s });

    if (isAdmin) {
      supabase.from("organizations").select("id, name, is_active").then(({ data }) => {
        set("admin_orgs", String(data?.length ?? 0), [
          { name: "Active", value: data?.filter((o) => o.is_active).length ?? 0 },
          { name: "Inactive", value: data?.filter((o) => !o.is_active).length ?? 0 },
        ]);
      });
      supabase.from("profiles").select("id", { count: "exact", head: true }).then(({ count }) => {
        set("admin_users", String(count ?? 0));
      });
      supabase.from("org_documents").select("id, status").then(({ data }) => {
        const pending = data?.filter((d) => d.status === "pending").length ?? 0;
        set("admin_pending", String(pending));
      });
      supabase.from("ai_analyses").select("id, status").then(({ data }) => {
        const completed = data?.filter((a) => a.status === "completed").length ?? 0;
        set("admin_ai", String(completed), [
          { name: "Completed", value: completed },
          { name: "Pending", value: data?.filter((a) => a.status === "pending").length ?? 0 },
          { name: "Processing", value: data?.filter((a) => a.status === "processing").length ?? 0 },
        ]);
      });
    }

    if ((isOriginatorAdmin || isBroker) && profile?.organization_id) {
      supabase.from("borrowers").select("id, onboarding_status, credit_limit").eq("organization_id", profile.organization_id).then(({ data }) => {
        set("orig_borrowers", String(data?.length ?? 0), [
          { name: "Approved", value: data?.filter((b) => b.onboarding_status === "approved").length ?? 0 },
          { name: "Under Review", value: data?.filter((b) => b.onboarding_status === "under_review").length ?? 0 },
          { name: "Invited", value: data?.filter((b) => b.onboarding_status === "invited").length ?? 0 },
        ]);
        // Total Limits (aggregate)
        const totalLimits = (data || []).reduce((sum, b) => sum + (Number(b.credit_limit) || 0), 0);
        set("orig_limits", totalLimits > 0 ? `£${(totalLimits / 1000).toFixed(0)}K` : "£0");
      });
      supabase.from("counterparties").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).then(({ count }) => {
        set("orig_counterparties", String(count ?? 0));
      });
      supabase.from("contracts").select("id, status").eq("organization_id", profile.organization_id).then(({ data }) => {
        const active = data?.filter((c) => c.status === "active").length ?? 0;
        set("orig_contracts", String(active), [
          { name: "Active", value: active },
          { name: "Expired", value: data?.filter((c) => c.status === "expired").length ?? 0 },
          { name: "Draft", value: data?.filter((c) => c.status === "draft").length ?? 0 },
        ]);
      });
      supabase.from("invoices").select("id, status, amount, due_date, accrued_late_fees").eq("organization_id", profile.organization_id).then(({ data }) => {
        const invs = (data || []) as any[];
        const pending = invs.filter((i) => i.status === "pending").length;
        set("orig_invoices", String(pending), [
          { name: "Pending", value: pending },
          { name: "Approved", value: invs.filter((i) => i.status === "approved").length },
          { name: "Funded", value: invs.filter((i) => i.status === "funded").length },
          { name: "Rejected", value: invs.filter((i) => i.status === "rejected").length },
        ]);
        // Outstanding = not settled/rejected
        const outstanding = invs
          .filter((i) => i.status !== "settled" && i.status !== "rejected")
          .reduce((sum, i) => sum + Number(i.amount) + Number(i.accrued_late_fees || 0), 0);
        set("orig_outstanding", outstanding > 0 ? `£${(outstanding / 1000).toFixed(0)}K` : "£0");
        
        // Overdue = past due_date and funded/partially_settled (GAP-25)
        const now = new Date();
        const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
        let totalOverdue = 0;

        invs.forEach(i => {
           if (i.status === "funded" || i.status === "partially_settled") {
             if (i.due_date && new Date(i.due_date) < now) {
                const diffDays = Math.floor((now.getTime() - new Date(i.due_date).getTime()) / (1000 * 60 * 60 * 24));
                const amt = Number(i.amount) + Number(i.accrued_late_fees || 0);
                totalOverdue += amt;
                if (diffDays <= 30) buckets["0-30"] += amt;
                else if (diffDays <= 60) buckets["31-60"] += amt;
                else if (diffDays <= 90) buckets["61-90"] += amt;
                else buckets["90+"] += amt;
             }
           }
        });
        
        const chartData = [
          { name: "0-30d", value: buckets["0-30"] },
          { name: "31-60d", value: buckets["31-60"] },
          { name: "61-90d", value: buckets["61-90"] },
          { name: "90+d", value: buckets["90+"] }
        ];

        set("orig_overdue", totalOverdue > 0 ? `£${(totalOverdue / 1000).toFixed(0)}K` : "£0", chartData);
      });
      supabase.from("credit_memos").select("id", { count: "exact", head: true }).eq("status", "draft").eq("organization_id", profile.organization_id).then(({ count }) => {
        set("orig_memos", String(count ?? 0));
      });
    }

    if (isBorrower && profile?.organization_id) {
      supabase.from("documents").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id).then(({ count }) => {
        set("borr_docs", String(count ?? 0));
      });
      supabase.from("invoices").select("id, status").eq("organization_id", profile.organization_id).then(({ data }) => {
        set("borr_invoices", String(data?.length ?? 0), [
          { name: "Pending", value: data?.filter((i) => i.status === "pending").length ?? 0 },
          { name: "Approved", value: data?.filter((i) => i.status === "approved").length ?? 0 },
        ]);
      });
      // Assuming borrower only has access to their own data via RLS, or we use organization_id / id depending on schema
      // FIN-BR1: Read currency from borrower record; group by currency for per-currency limits
      supabase
        .from("borrowers")
        .select("credit_limit, limit_currency")
        .eq("user_id", user!.id)
        .then(({ data }) => {
          if (!data || data.length === 0) { set("borr_credit", "—"); return; }
          // Group by currency
          const byCurrency: Record<string, number> = {};
          for (const b of data) {
            const cur = b.limit_currency || "GBP";
            byCurrency[cur] = (byCurrency[cur] || 0) + Number(b.credit_limit || 0);
          }
          const currencies = Object.keys(byCurrency);
          if (currencies.length === 1) {
            const [cur] = currencies;
            const val = byCurrency[cur];
            set("borr_credit", val >= 1_000_000
              ? `${cur} ${(val / 1_000_000).toFixed(1)}M`
              : val >= 1_000
              ? `${cur} ${(val / 1_000).toFixed(0)}K`
              : `${cur} ${val.toFixed(2)}`);
          } else {
            // Multi-currency: show first currency + indicator
            const firstCur = currencies[0];
            set("borr_credit",
              `${firstCur} ${(byCurrency[firstCur] / 1_000).toFixed(0)}K (+${currencies.length - 1} more)`);
          }
        });

      // FIN-BR2: Surface discounting rate, advance rate, overdue rate (but NOT funder margins)
      // Fetch from the most recent approved facility_request for this borrower
      supabase
        .from("facility_requests" as any)
        .select("final_discounting_rate, advance_rate, overdue_fee_pct")
        .eq("organization_id", profile.organization_id)
        .in("status", ["approved", "active"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .then(({ data: facData }: any) => {
          const fac = facData?.[0];
          if (fac) {
            const dr = fac.final_discounting_rate != null ? `${fac.final_discounting_rate}% disc` : null;
            const ar = fac.advance_rate != null ? `${fac.advance_rate}% adv` : null;
            const or_ = fac.overdue_fee_pct != null ? `${fac.overdue_fee_pct}% ovd` : null;
            const parts = [dr, ar, or_].filter(Boolean);
            set("borr_rates", parts.length ? parts.join(" · ") : "See offer letter");
          } else {
            set("borr_rates", "No active facility");
          }
        });
    }

    if (isFunder && user) {
      (supabase as any).from("funding_offers").select("offer_amount, status").eq("funder_user_id", user.id).then(({ data }: any) => {
        const accepted = data?.filter((o: any) => o.status === "accepted") ?? [];
        const total = accepted.reduce((sum: number, o: any) => sum + Number(o.offer_amount), 0);
        set("fund_portfolio", total > 0 ? `£${(total / 1000000).toFixed(1)}M` : "£0", [
          { name: "Accepted", value: accepted.length },
          { name: "Pending", value: data?.filter((o: any) => o.status === "pending").length ?? 0 },
        ]);
      });
      (supabase as any).from("funding_offers").select("id", { count: "exact", head: true }).eq("funder_user_id", user.id).eq("status", "accepted").then(({ count }: any) => {
        set("fund_deals", String(count ?? 0));
      });
      // Show count of pending limit referrals
      supabase.from("funder_limits").select("id", { count: "exact", head: true }).eq("funder_user_id", user.id).eq("status", "pending").then(({ count }) => {
        set("fund_market", count && count > 0 ? `${count} pending` : "Review");
      });
    }
  }, [isAdmin, isOriginatorAdmin, isBorrower, isFunder, isBroker]);

  // ── Render ────────────────────────────────────────────────────────────────

  const visibleWidgets = relevantWidgets.filter((w) => isVisible(w.id));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {profile?.full_name ? `Welcome back, ${profile.full_name}` : "Welcome back!"}
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening on your platform today.
            </p>
            <div className="mt-2 flex gap-2">
              {roles.map((role) => (
                <Badge key={role} variant="secondary" className="capitalize">
                  {role.replace("_", " ")}
                </Badge>
              ))}
            </div>
            
            {/* Quick Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              {isAdmin && (
                <Button onClick={() => navigate("/admin/organizations")} className="gap-2">
                  <Building2 className="h-4 w-4" /> Add Originator
                </Button>
              )}
              {isOriginatorAdmin && (
                <>
                  <Button onClick={() => navigate("/originator/invoices")} className="gap-2">
                    <FileText className="h-4 w-4" /> New Invoice
                  </Button>
                  <Button onClick={() => navigate("/originator/invite")} variant="outline" className="gap-2">
                    <Users className="h-4 w-4" /> Invite User
                  </Button>
                </>
              )}
              {isBroker && (
                <>
                  <Button onClick={() => navigate("/broker/invoices")} className="gap-2">
                    <FileText className="h-4 w-4" /> New Invoice
                  </Button>
                  <Button onClick={() => navigate("/broker/borrowers")} variant="outline" className="gap-2">
                    <Users className="h-4 w-4" /> Add Borrower
                  </Button>
                </>
              )}
              {isBorrower && (
                <>
                  <Button onClick={() => navigate("/borrower/invoices")} className="gap-2">
                    <FileText className="h-4 w-4" /> Submit Invoice
                  </Button>
                  <Button onClick={() => navigate("/borrower/documents")} variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" /> Upload Document
                  </Button>
                </>
              )}
              {isFunder && (
                <Button onClick={() => navigate("/funder/marketplace")} className="gap-2">
                  <Search className="h-4 w-4" /> Browse Marketplace
                </Button>
              )}
            </div>
          </div>

          {/* Customize button */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" /> Customize
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Dashboard Widgets</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {relevantWidgets.map((w) => {
                  const vis = isVisible(w.id);
                  const mode = getViewMode(w.id);
                  return (
                    <div key={w.id} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <w.icon className="h-4 w-4 text-muted-foreground" />
                          <Label className="text-sm font-medium">{w.title}</Label>
                        </div>
                        <Switch
                          checked={vis}
                          onCheckedChange={(checked) => updateWidget(w.id, { visible: checked })}
                        />
                      </div>
                      {vis && w.supportsChart && (
                        <div className="flex gap-1">
                          {(["card", "chart", "table"] as const).map((m) => (
                            <Button
                              key={m}
                              size="sm"
                              variant={mode === m ? "default" : "outline"}
                              className="h-7 text-xs gap-1"
                              onClick={() => updateWidget(w.id, { viewMode: m })}
                            >
                              {m === "card" && <BarChart3 className="h-3 w-3" />}
                              {m === "chart" && <BarChart2 className="h-3 w-3" />}
                              {m === "table" && <TableIcon className="h-3 w-3" />}
                              {m.charAt(0).toUpperCase() + m.slice(1)}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Widgets grid */}
        <div className="mb-6">
          {user?.id && <ActorWalletCard actorId={user.id} />}
        </div>
        
        {!prefsLoaded ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : visibleWidgets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <EyeOff className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">All widgets are hidden. Click Customize to show them.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleWidgets.map((w) => {
              const stat = stats[w.id];
              const mode = getViewMode(w.id);
              const nav = w.navigateTo ? () => navigate(
                w.role === "originator" && isBroker
                  ? w.navigateTo!.replace("/originator", "/broker")
                  : w.navigateTo!
              ) : undefined;

              if (mode === "chart" && w.supportsChart && stat?.chartData) {
                return (
                  <Card key={w.id} className="col-span-1 sm:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{w.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{stat.value}</Badge>
                        <w.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stat.chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                          <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {stat.chartData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                );
              }

              if (mode === "table" && w.supportsChart && stat?.chartData) {
                return (
                  <Card key={w.id} className="col-span-1 sm:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{w.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Total: {stat.value}</Badge>
                        <w.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Count</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stat.chartData.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                              <TableCell className="text-right">{row.value}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              }

              // Default card view
              return (
                <Card
                  key={w.id}
                  className={nav ? "cursor-pointer transition-shadow hover:shadow-md" : ""}
                  onClick={nav}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{w.title}</CardTitle>
                    <w.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    {stat?.loading !== false ? (
                      <Skeleton className="h-8 w-24 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold">{stat.value}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{w.subtitle}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
