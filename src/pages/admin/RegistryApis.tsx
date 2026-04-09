import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Globe, Key, Settings2, Database, ShieldAlert, Zap, Clock, Activity, Play, Server, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { DEFAULT_REGISTRIES, REGISTRY_CAPABILITIES } from "@/lib/onboarding-types";

// ── Collapsible section component for Platform APIs ────────────────────────
interface PlatformApiSectionProps {
  label: string;
  items: any[];
  unhealthyCount: number;
  inactiveCount: number;
  healthyCount: number;
  unknownCount: number;
  allInactive: boolean;
  defaultOpen: boolean;
  invokingApi: string | null;
  platformHealthIcon: (status: string) => React.ReactNode;
  togglePlatformApiActive: (id: string, isActive: boolean) => void;
  invokePlatformApi: (api: any) => void;
}

function PlatformApiSection({
  label, items, unhealthyCount, inactiveCount, healthyCount, unknownCount,
  allInactive, defaultOpen, invokingApi,
  platformHealthIcon, togglePlatformApiActive, invokePlatformApi,
}: PlatformApiSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  const headerBg = unhealthyCount > 0
    ? "bg-destructive/5 border-destructive/20"
    : allInactive
      ? "bg-muted/30 border-border"
      : "bg-card border-border";

  return (
    <div className={`rounded-lg border overflow-hidden ${headerBg}`}>
      {/* Section header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        {open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

        <span className={`text-sm font-semibold ${allInactive ? "text-muted-foreground" : "text-foreground"}`}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground">
          {items.length} function{items.length !== 1 ? "s" : ""}
        </span>

        {/* Status summary pills */}
        <div className="flex items-center gap-1.5 ml-auto">
          {unhealthyCount > 0 && (
            <Badge variant="destructive" className="text-[10px] gap-1 py-0">
              <XCircle className="h-2.5 w-2.5" />{unhealthyCount} unhealthy
            </Badge>
          )}
          {inactiveCount > 0 && (
            <Badge variant="secondary" className="text-[10px] py-0">
              {inactiveCount} inactive
            </Badge>
          )}
          {unknownCount > 0 && (
            <Badge variant="outline" className="text-[10px] py-0">
              {unknownCount} unknown
            </Badge>
          )}
          {healthyCount > 0 && (
            <Badge className="text-[10px] gap-1 py-0 bg-emerald-600 text-white">
              <CheckCircle2 className="h-2.5 w-2.5" />{healthyCount} healthy
            </Badge>
          )}
        </div>
      </button>

      {/* Collapsible rows */}
      {open && (
        <div className="border-t border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">Function</TableHead>
                <TableHead className="text-xs">Required Secrets</TableHead>
                <TableHead className="text-xs">Cron</TableHead>
                <TableHead className="text-xs">Last Run</TableHead>
                <TableHead className="text-xs">Health</TableHead>
                <TableHead className="text-xs">Active</TableHead>
                <TableHead className="text-xs text-right">Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((api) => (
                <TableRow
                  key={api.id}
                  className={[
                    !api.is_active ? "opacity-50" : "",
                    api.health_status === "unhealthy" ? "bg-destructive/5" : "",
                  ].join(" ")}
                >
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-foreground">{api.display_name}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">{api.api_name}</p>
                      {api.health_message && api.health_status === "unhealthy" && (
                        <p className="text-[10px] text-destructive mt-0.5 max-w-[260px] truncate" title={api.health_message}>
                          {api.health_message}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(api.requires_secrets || []).length === 0 ? (
                        <Badge variant="outline" className="text-[10px]">None</Badge>
                      ) : (api.requires_secrets || []).map((s: string) => (
                        <Badge key={s} variant="outline" className="text-[10px] font-mono">
                          <Key className="mr-1 h-2.5 w-2.5" />{s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {api.cron_schedule ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="font-mono">{api.cron_schedule}</span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">On-demand</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {api.last_invoked_at
                      ? new Date(api.last_invoked_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })
                      : <span className="text-muted-foreground/50">Never</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {platformHealthIcon(api.health_status)}
                      <span className="text-xs capitalize text-muted-foreground">{api.health_status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={api.is_active}
                      onCheckedChange={() => togglePlatformApiActive(api.id, api.is_active)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={invokingApi === api.id || !api.is_active}
                      onClick={() => invokePlatformApi(api)}
                      title={!api.is_active ? "Enable function first" : `Invoke ${api.api_name}`}
                    >
                      {invokingApi === api.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Play className="h-3.5 w-3.5" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function RegistryApis() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<any>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [expandedUnhealthyIds, setExpandedUnhealthyIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("external");
  const [platformApis, setPlatformApis] = useState<any[]>([]);
  const [platformLoading, setPlatformLoading] = useState(true);
  const [invokingApi, setInvokingApi] = useState<string | null>(null);

  const emptyForm = {
    country_code: "",
    country_name: "",
    registry_name: "",
    client_id: "",
    api_base_url: "",
    api_key_secret_name: "",
    api_key_value: "",
    capabilities: [] as string[],
    registry_type: "rest" as "rest" | "ckan",
    ckan_dataset_id: "",
    ckan_resource_id: "",
    ckan_search_action: "package_search",
    ckan_show_action: "package_show",
    ckan_query_field_mapping: '{"acn": "q", "name": "q", "abn": "q"}',
  };

  const [form, setForm] = useState(emptyForm);

  useEffect(() => { fetchConfigs(); fetchPlatformApis(); }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    const { data } = await supabase.from("registry_api_configs").select("*").order("country_name");
    setConfigs(data || []);
    setLoading(false);
  };

  const seedDefaults = async () => {
    for (const reg of DEFAULT_REGISTRIES) {
      const exists = configs.find((c) => c.country_code === reg.country_code && c.registry_name === reg.registry_name);
      if (!exists) {
        await supabase.from("registry_api_configs").insert(reg);
      }
    }
    toast.success("Default registries seeded");
    fetchConfigs();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase.from("registry_api_configs").update({ is_active: !isActive }).eq("id", id);
    fetchConfigs();
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const fetchPlatformApis = async () => {
    setPlatformLoading(true);
    const { data } = await db
      .from("platform_api_configs")
      .select("*")
      .order("category")
      .order("display_name");
    setPlatformApis(data || []);
    setPlatformLoading(false);
  };

  const togglePlatformApiActive = async (id: string, isActive: boolean) => {
    await db.from("platform_api_configs").update({ is_active: !isActive }).eq("id", id);
    fetchPlatformApis();
  };

  const invokePlatformApi = async (api: any) => {
    setInvokingApi(api.id);
    try {
      const { error } = await supabase.functions.invoke(api.api_name, { body: {} });
      if (error) throw error;
      await db.from("platform_api_configs").update({
        last_invoked_at: new Date().toISOString(),
        health_status: "healthy",
        health_message: null,
      }).eq("id", api.id);
      toast.success(`${api.display_name}: invoked successfully`);
    } catch (err: any) {
      const msg = err.message || "Invocation failed";
      await db.from("platform_api_configs").update({
        health_status: "unhealthy",
        health_message: msg,
      }).eq("id", api.id);
      toast.error(`${api.display_name}: ${msg}`);
    }
    setInvokingApi(null);
    fetchPlatformApis();
  };

  const testApi = async (config: any) => {
    setTesting(config.id);
    try {
      const { data, error } = await supabase.functions.invoke("registry-lookup", {
        body: { action: "health_check", registry_id: config.id },
      });
      if (error) throw error;
      toast.success(`${config.registry_name}: ${data?.status || "OK"}`);
    } catch (err: any) {
      toast.error(`${config.registry_name}: ${err.message || "Failed"}`);
    }
    setTesting(null);
    fetchConfigs();
  };

  const saveConfig = async () => {
    if (!form.country_code || !form.registry_name || !form.api_key_secret_name) {
      toast.error("Fill required fields");
      return;
    }
    if (form.registry_type === "ckan" && !form.ckan_dataset_id) {
      toast.error("Dataset ID is required for CKAN registries");
      return;
    }
    // Validate JSON mapping
    if (form.registry_type === "ckan") {
      try {
        JSON.parse(form.ckan_query_field_mapping);
      } catch {
        toast.error("Query Field Mapping must be valid JSON");
        return;
      }
    }

    const payload: any = {
      country_code: form.country_code,
      country_name: form.country_name,
      registry_name: form.registry_name,
      client_id: form.client_id.trim() || null,
      api_base_url: form.api_base_url,
      api_key_secret_name: form.api_key_secret_name,
      capabilities: form.capabilities,
      registry_type: form.registry_type,
      ckan_dataset_id: form.registry_type === "ckan" ? form.ckan_dataset_id : null,
      ckan_resource_id: form.registry_type === "ckan" ? (form.ckan_resource_id || null) : null,
      ckan_search_action: form.registry_type === "ckan" ? form.ckan_search_action : "package_search",
      ckan_show_action: form.registry_type === "ckan" ? form.ckan_show_action : "package_show",
      ckan_query_field_mapping: form.registry_type === "ckan" ? JSON.parse(form.ckan_query_field_mapping) : {},
    };
    if (form.api_key_value.trim()) {
      payload.api_key_value = form.api_key_value.trim();
    }
    if (editConfig) {
      await supabase.from("registry_api_configs").update(payload).eq("id", editConfig.id);
    } else {
      if (!form.api_key_value.trim()) {
        payload.api_key_value = null;
      }
      await supabase.from("registry_api_configs").insert(payload);
    }
    setDialogOpen(false);
    setEditConfig(null);
    fetchConfigs();
    toast.success("Saved");
  };

  const openEdit = (config: any) => {
    setEditConfig(config);
    setForm({
      country_code: config.country_code,
      country_name: config.country_name,
      registry_name: config.registry_name,
      client_id: config.client_id || "",
      api_base_url: config.api_base_url,
      api_key_secret_name: config.api_key_secret_name,
      api_key_value: config.api_key_value || "",
      capabilities: config.capabilities || [],
      registry_type: config.registry_type || "rest",
      ckan_dataset_id: config.ckan_dataset_id || "",
      ckan_resource_id: config.ckan_resource_id || "",
      ckan_search_action: config.ckan_search_action || "package_search",
      ckan_show_action: config.ckan_show_action || "package_show",
      ckan_query_field_mapping: config.ckan_query_field_mapping
        ? JSON.stringify(config.ckan_query_field_mapping, null, 2)
        : '{}',
    });
    setDialogOpen(true);
  };

  const healthIcon = (status: string) => {
    if (status === "healthy") return <CheckCircle2 className="h-4 w-4 text-[hsl(var(--chart-2))]" />;
    if (status === "unhealthy") return <XCircle className="h-4 w-4 text-destructive" />;
    return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  };

  const PLATFORM_CATEGORY_LABELS: Record<string, string> = {
    settlement: "Settlement & Ledger",
    ledger: "Ledger",
    market_data: "Market Data",
    notifications: "Notifications",
    psp: "Payment Service Provider",
    auth: "Authentication & Access",
    kyb: "KYB & Registry",
    ai: "AI Services",
    communications: "Communications",
    other: "Other",
  };

  const PLATFORM_CATEGORY_ORDER = [
    "settlement", "market_data", "psp", "communications",
    "auth", "kyb", "ai", "other",
  ];

  const platformHealthIcon = (status: string) => {
    if (status === "healthy") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    if (status === "unhealthy") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">API Management</h1>
            <p className="text-sm text-muted-foreground">Manage external registry APIs and internal platform edge functions</p>
          </div>
          {activeTab === "external" ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={seedDefaults}>
                <Globe className="mr-2 h-4 w-4" /> Seed Defaults
              </Button>
              <Button onClick={() => { setEditConfig(null); setForm({ ...emptyForm }); setDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Add Registry
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={fetchPlatformApis}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="external">
              <Globe className="mr-2 h-4 w-4" /> External APIs
            </TabsTrigger>
            <TabsTrigger value="platform">
              <Server className="mr-2 h-4 w-4" /> Platform APIs
            </TabsTrigger>
          </TabsList>

          {/* ── PLATFORM APIs TAB ─────────────────────────────────────── */}
          <TabsContent value="platform" className="space-y-3 mt-4">
            {/* Page-level summary bar */}
            {!platformLoading && platformApis.length > 0 && (() => {
              const unhealthyCount = platformApis.filter(a => a.health_status === "unhealthy").length;
              const inactiveCount  = platformApis.filter(a => !a.is_active).length;
              const healthyCount   = platformApis.filter(a => a.health_status === "healthy" && a.is_active).length;
              return (
                <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
                  <Zap className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground">{platformApis.length} edge functions</span>
                  <div className="flex items-center gap-2 ml-auto">
                    {unhealthyCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <XCircle className="h-3 w-3" />{unhealthyCount} unhealthy
                      </Badge>
                    )}
                    {inactiveCount > 0 && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        {inactiveCount} inactive
                      </Badge>
                    )}
                    {healthyCount > 0 && (
                      <Badge className="text-[10px] gap-1 bg-emerald-600 text-white">
                        <CheckCircle2 className="h-3 w-3" />{healthyCount} healthy
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground hidden md:block">
                    Secrets → Supabase Dashboard → Settings → Edge Functions → Secrets
                  </p>
                </div>
              );
            })()}

            {platformLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : platformApis.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 rounded-lg border border-dashed">
                <AlertCircle className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No platform APIs found. Run the <code className="font-mono text-xs">20260409300000_platform_api_configs.sql</code> migration.</p>
              </div>
            ) : (() => {
              // Group by category
              const grouped: Record<string, any[]> = {};
              for (const api of platformApis) {
                const cat = api.category || "other";
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(api);
              }

              return PLATFORM_CATEGORY_ORDER.map((cat) => {
                const items = grouped[cat];
                if (!items || items.length === 0) return null;

                const unhealthy = items.filter(a => a.health_status === "unhealthy");
                const inactive  = items.filter(a => !a.is_active);
                const healthy   = items.filter(a => a.health_status === "healthy" && a.is_active);
                const unknown   = items.filter(a => a.health_status === "unknown" && a.is_active);

                // Auto-expand if any API in this section is unhealthy; collapse otherwise
                const defaultOpen = unhealthy.length > 0;
                const allInactive = items.every(a => !a.is_active);

                return (
                  <PlatformApiSection
                    key={cat}
                    label={PLATFORM_CATEGORY_LABELS[cat] || cat}
                    items={items}
                    unhealthyCount={unhealthy.length}
                    inactiveCount={inactive.length}
                    healthyCount={healthy.length}
                    unknownCount={unknown.length}
                    allInactive={allInactive}
                    defaultOpen={defaultOpen}
                    invokingApi={invokingApi}
                    platformHealthIcon={platformHealthIcon}
                    togglePlatformApiActive={togglePlatformApiActive}
                    invokePlatformApi={invokePlatformApi}
                  />
                );
              });
            })()}

            {/* Secrets reference card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" />
                  Required Secrets Reference
                </CardTitle>
                <CardDescription>
                  Set these in Supabase Dashboard → Settings → Edge Functions → Secrets. None of these values are stored in the database.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { name: "ANTHROPIC_API_KEY", desc: "Claude AI — all AI analysis functions", url: "console.anthropic.com" },
                    { name: "RESEND_API_KEY", desc: "Email delivery — notifications & counterparty emails", url: "resend.com/api-keys" },
                    { name: "FRED_API_KEY", desc: "SOFR/SONIA live rate fetch from St. Louis Fed", url: "fred.stlouisfed.org/docs/api/api_key.html" },
                    { name: "PSP_WEBHOOK_SECRET", desc: "Shared secret to authenticate PSP webhook callbacks", url: "" },
                    { name: "TRUELAYER_CLIENT_ID", desc: "TrueLayer open banking — account name verification", url: "console.truelayer.com" },
                    { name: "TRUELAYER_CLIENT_SECRET", desc: "TrueLayer client secret (paired with CLIENT_ID)", url: "console.truelayer.com" },
                    { name: "GETADDRESS_API_KEY", desc: "getAddress.io — UK postcode & address lookup", url: "getaddress.io" },
                  ].map((secret) => {
                    const isUsed = platformApis.some((api) =>
                      (api.requires_secrets || []).includes(secret.name)
                    );
                    return (
                      <div key={secret.name} className="rounded-lg border p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs font-mono font-semibold text-foreground">{secret.name}</code>
                          {isUsed && <Badge variant="outline" className="text-[10px]">In use</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">{secret.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── EXTERNAL APIs TAB ─────────────────────────────────────── */}
          <TabsContent value="external" className="space-y-4 mt-4">

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : configs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <Globe className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No registries configured. Click "Seed Defaults" to add common registries.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Country</TableHead>
                    <TableHead>Registry / Tool</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Secret Name</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const SANCTIONS_CAPS = ["sanctions_screening", "pep_screening"];
                    const BANK_CAPS = ["iban_validation", "sort_code_validation", "account_name_verification"];
                    const FINANCIAL_CAPS = ["financial_data", "credit_scores", "financial_statements"];
                    const ADDRESS_CAPS = ["address_lookup"];

                    const hasCap = (c: any, caps: string[]) =>
                      (c.capabilities || []).some((cap: string) => caps.includes(cap));

                    const categorize = (c: any): string => {
                      if (hasCap(c, SANCTIONS_CAPS)) return "Sanctions Screening";
                      if (hasCap(c, BANK_CAPS)) return "Bank Account Validation";
                      if (hasCap(c, FINANCIAL_CAPS)) return "Financial Inputs";
                      if (hasCap(c, ADDRESS_CAPS)) return "Address Lookup";
                      return "Company Registries";
                    };

                    // Sort: active+unhealthy first, active+healthy, inactive+healthy, inactive+unhealthy/unknown
                    const sortOrder = (c: any): number => {
                      const active = c.is_active;
                      const healthy = c.health_status === "healthy";
                      const unhealthy = c.health_status === "unhealthy";
                      if (active && unhealthy) return 0;
                      if (active && healthy) return 1;
                      if (active) return 2; // unknown
                      if (!active && healthy) return 3;
                      if (!active && unhealthy) return 4;
                      return 5; // inactive unknown
                    };

                    const sortedConfigs = [...configs].sort((a, b) => {
                      const oa = sortOrder(a);
                      const ob = sortOrder(b);
                      if (oa !== ob) return oa - ob;
                      return (a.country_name || "").localeCompare(b.country_name || "");
                    });

                    const sectionOrder = ["Company Registries", "Financial Inputs", "Sanctions Screening", "Bank Account Validation", "Address Lookup"];
                    const grouped: Record<string, any[]> = {};
                    for (const c of sortedConfigs) {
                      const cat = categorize(c);
                      if (!grouped[cat]) grouped[cat] = [];
                      grouped[cat].push(c);
                    }

                    const renderRows = (items: any[]) => items.map((c) => {
                      const isUnhealthy = c.health_status === "unhealthy";
                      const isExpanded = expandedUnhealthyIds.has(c.id);

                      if (isUnhealthy && !isExpanded) {
                        return (
                          <TableRow key={c.id} className="bg-destructive/5 hover:bg-destructive/10 cursor-pointer" onClick={() => {
                            const next = new Set(expandedUnhealthyIds);
                            next.add(c.id);
                            setExpandedUnhealthyIds(next);
                          }}>
                            <TableCell colSpan={8} className="py-3">
                               <div className="flex items-center gap-3">
                                 <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-destructive/10 flex-shrink-0">
                                   <Plus className="h-4 w-4 text-destructive" />
                                 </div>
                                 {healthIcon(c.health_status)}
                                 <span className="font-semibold text-foreground text-sm">{c.country_name || 'Global'} — {c.registry_name}</span>
                                 <Badge variant="destructive" className="text-[10px] uppercase">Unhealthy Configuration</Badge>
                                 <span className="text-xs text-muted-foreground ml-auto hidden sm:inline-flex">Click to expand details</span>
                               </div>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                          {c.country_name}
                          {c.country_code === "EU" && (
                            <Badge variant="outline" className="ml-2 text-[10px]">30 countries</Badge>
                          )}
                          {c.country_code === "GLOBAL" && (
                            <Badge variant="outline" className="ml-2 text-[10px]">Global</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{c.registry_name}</TableCell>
                        <TableCell>
                          <Badge variant={c.registry_type === "ckan" ? "secondary" : "outline"} className="text-[10px] uppercase">
                            {c.registry_type === "ckan" ? (
                              <><Database className="mr-1 h-3 w-3" />CKAN</>
                            ) : (
                              "REST"
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs font-mono"><Key className="mr-1 h-3 w-3" />{c.api_key_secret_name}</Badge>
                            {c.api_key_secret_name === "NO_AUTH_NEEDED" ? (
                              <Badge variant="secondary" className="text-[10px]">No auth required</Badge>
                            ) : c.api_key_value ? (
                              <Badge variant="default" className="text-[10px]">Key set</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">No key</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(c.capabilities || []).slice(0, 3).map((cap: string) => (
                              <Badge key={cap} variant="secondary" className="text-[10px]">{cap.replace(/_/g, " ")}</Badge>
                            ))}
                            {(c.capabilities || []).length > 3 && (
                              <Badge variant="secondary" className="text-[10px]">+{c.capabilities.length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {healthIcon(c.health_status)}
                            <span className="text-xs capitalize text-muted-foreground">{c.health_status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => testApi(c)} disabled={testing === c.id}>
                              {testing === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                              <Settings2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });

                    return (
                      <>
                        {sectionOrder.map((section) => {
                          const items = grouped[section];
                          if (!items || items.length === 0) return null;
                          return (
                            <React.Fragment key={section}>
                              <TableRow>
                                <TableCell colSpan={8} className="bg-muted/50 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  {section}
                                </TableCell>
                              </TableRow>
                              {renderRows(items)}
                            </React.Fragment>
                          );
                        })}
                      </>
                    );
                  })()}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Fraud Detection Providers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Fraud Detection Providers
            </CardTitle>
            <CardDescription>
              Configure third-party fraud detection APIs. Add providers with the "fraud_detection" capability to enable automated invoice fraud screening.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { name: "MonetaGo", desc: "Invoice duplication registry — prevents double-financing across lenders", url: "https://api.monetago.com/v1" },
                { name: "Coface", desc: "Trade credit insurance & fraud signals", url: "https://api.coface.com/v1" },
                { name: "Atradius", desc: "Buyer risk assessment and fraud detection", url: "https://api.atradius.com/v1" },
                { name: "Dun & Bradstreet", desc: "Supplier risk scores and business verification", url: "https://api.dnb.com/v1" },
                { name: "Creditsafe", desc: "Company credit reports and fraud indicators", url: "https://api.creditsafe.com/v1" },
              ].map((provider) => {
                const isConfigured = configs.some(
                  (c) => c.registry_name === provider.name && (c.capabilities || []).includes("fraud_detection")
                );
                return (
                  <div key={provider.name} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{provider.name}</p>
                      {isConfigured ? (
                        <Badge variant="default" className="text-[10px]">Configured</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Not configured</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{provider.desc}</p>
                    {!isConfigured && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs mt-2"
                        onClick={() => {
                          setEditConfig(null);
                          setForm({
                            ...emptyForm,
                            country_code: "GLOBAL",
                            country_name: "Global",
                            registry_name: provider.name,
                            api_base_url: provider.url,
                            api_key_secret_name: `${provider.name.replace(/[^a-zA-Z]/g, "_").toUpperCase()}_API_KEY`,
                            capabilities: ["fraud_detection"],
                          });
                          setDialogOpen(true);
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Configure
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Address Lookup Providers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Address Lookup Providers
            </CardTitle>
            <CardDescription>
              Configure address autocomplete providers. Only one provider can be active at a time — the first active entry with the <strong>address_lookup</strong> capability is used. Photon (OpenStreetMap) is the free built-in fallback and requires no API key.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { name: "Google Places", desc: "High-quality global address autocomplete with structured parsing. Best accuracy.", url: "https://maps.googleapis.com/maps/api", secretName: "GOOGLE_PLACES_API_KEY" },
                { name: "Loqate (GBG)", desc: "UK-focused enterprise address lookup with postcode and international coverage.", url: "https://api.addressy.com/Capture/Interactive/Find/v1.10/json3.ws", secretName: "LOQATE_API_KEY" },
                { name: "Photon (OpenStreetMap)", desc: "Free, open-source address lookup powered by OSM. No API key required.", url: "https://photon.komoot.io", secretName: "NO_AUTH_NEEDED" },
              ].map((provider) => {
                const isConfigured = configs.some(
                  (c) => c.registry_name === provider.name && (c.capabilities || []).includes("address_lookup")
                );
                const isActive = configs.find(
                  (c) => c.registry_name === provider.name && (c.capabilities || []).includes("address_lookup")
                )?.is_active;
                return (
                  <div key={provider.name} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{provider.name}</p>
                      {isConfigured ? (
                        <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">{isActive ? "Active" : "Configured"}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Not configured</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{provider.desc}</p>
                    {!isConfigured && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs mt-2"
                        onClick={() => {
                          setEditConfig(null);
                          setForm({
                            ...emptyForm,
                            country_code: "GLOBAL",
                            country_name: "Global",
                            registry_name: provider.name,
                            api_base_url: provider.url,
                            api_key_secret_name: provider.secretName,
                            capabilities: ["address_lookup"],
                          });
                          setDialogOpen(true);
                        }}
                      >
                        <Plus className="mr-1 h-3 w-3" /> Configure
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              💡 To switch providers: disable the current active one and enable a different provider. Only the first active <em>address_lookup</em> entry is used.
            </p>
          </CardContent>
        </Card>

        {/* Fraud Engine Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Internal Fraud Engine Configuration
            </CardTitle>
            <CardDescription>
              Configure engine thresholds for automated fraud and duplicate detection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 max-w-2xl">
              <div>
                <h4 className="text-sm font-medium mb-2">Score Thresholds</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-amber-600 dark:text-amber-400">Flag Above Score</Label>
                    <Input type="number" defaultValue="40" />
                    <p className="text-[10px] text-muted-foreground">Invoices above this score require manual override.</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-destructive">Block Above Score</Label>
                    <Input type="number" defaultValue="70" />
                    <p className="text-[10px] text-muted-foreground">Invoices above this score are permanently blocked.</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-2">
                <h4 className="text-sm font-medium mb-3 flex items-center justify-between">
                  Duplicate Invoice Check
                  <Switch defaultChecked />
                </h4>
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border">
                  <div className="space-y-2 p-1">
                    <div className="flex justify-between items-center mb-2">
                      <Label>Similarity Threshold (%)</Label>
                      <span className="text-sm font-medium">95%</span>
                    </div>
                    <Slider defaultValue={[95]} max={100} min={60} step={1} />
                    <p className="text-[10px] text-muted-foreground mt-2">Matches with similarity above this are flagged as duplicates.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Scope</Label>
                    <Select defaultValue="cross_org">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cross_org">Cross-Organization (Platform Wide)</SelectItem>
                        <SelectItem value="same_org">Same Organization Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button onClick={() => toast.success("Fraud engine configuration saved")}>Save Configuration</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Capabilities Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Available API Capabilities</CardTitle>
            <CardDescription>These are the data types that can be fetched from each registry</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {REGISTRY_CAPABILITIES.map((cap) => (
                <div key={cap} className="rounded-md border px-3 py-2 text-xs capitalize text-foreground">{cap.replace(/_/g, " ")}</div>
              ))}
            </div>
          </CardContent>
        </Card>

          </TabsContent>
        </Tabs>
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editConfig ? "Edit Registry" : "Add Registry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Registry Type */}
            <div className="space-y-2">
              <Label>Registry Type *</Label>
              <Select value={form.registry_type} onValueChange={(v) => setForm({ ...form, registry_type: v as "rest" | "ckan" })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rest">Simple REST</SelectItem>
                  <SelectItem value="ckan">CKAN Portal</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {form.registry_type === "ckan"
                  ? "For CKAN-based open data portals (e.g. data.gov.au, data.gov.uk)"
                  : "Standard REST API with direct endpoints (e.g. Companies House)"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country Code *</Label>
                <Input value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })} placeholder="AU" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>Country Name *</Label>
                <Input value={form.country_name} onChange={(e) => setForm({ ...form, country_name: e.target.value })} placeholder="Australia" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Registry Name *</Label>
              <Input value={form.registry_name} onChange={(e) => setForm({ ...form, registry_name: e.target.value })} placeholder={form.registry_type === "ckan" ? "Data.gov.au ASIC" : "Companies House"} />
            </div>
            <div className="space-y-2">
              <Label>Client ID <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                placeholder="e.g. sandbox-vybre1-74baba"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Required for OAuth2-based APIs like TrueLayer. The Client Secret goes in the API Key Value field below.
              </p>
            </div>
            <div className="space-y-2">
              <Label>{form.registry_type === "ckan" ? "CKAN Portal Base URL *" : "API Base URL"}</Label>
              <Input value={form.api_base_url} onChange={(e) => setForm({ ...form, api_base_url: e.target.value })} placeholder={form.registry_type === "ckan" ? "https://data.gov.au" : "https://api.example.com"} />
              {form.registry_type === "ckan" && (
                <p className="text-xs text-muted-foreground">The root URL of the CKAN portal (without /api/3/action)</p>
              )}
            </div>

            {/* CKAN-specific fields */}
            {form.registry_type === "ckan" && (
              <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Database className="h-4 w-4 text-primary" />
                  CKAN Configuration
                </div>
                <div className="space-y-2">
                  <Label>Dataset ID or Name *</Label>
                  <Input
                    value={form.ckan_dataset_id}
                    onChange={(e) => setForm({ ...form, ckan_dataset_id: e.target.value })}
                    placeholder="asic-companies or package UUID"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">The CKAN package/dataset identifier</p>
                </div>
                <div className="space-y-2">
                  <Label>Resource ID <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={form.ckan_resource_id}
                    onChange={(e) => setForm({ ...form, ckan_resource_id: e.target.value })}
                    placeholder="Resource UUID for datastore_search"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">If set, uses datastore_search on this resource instead of package_search</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Search Action</Label>
                    <Input
                      value={form.ckan_search_action}
                      onChange={(e) => setForm({ ...form, ckan_search_action: e.target.value })}
                      placeholder="package_search"
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Show Action</Label>
                    <Input
                      value={form.ckan_show_action}
                      onChange={(e) => setForm({ ...form, ckan_show_action: e.target.value })}
                      placeholder="package_show"
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Query Field Mapping (JSON)</Label>
                  <Textarea
                    value={form.ckan_query_field_mapping}
                    onChange={(e) => setForm({ ...form, ckan_query_field_mapping: e.target.value })}
                    placeholder='{"acn": "q", "name": "q"}'
                    className="font-mono text-sm min-h-[80px]"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maps search fields to CKAN query parameters. Keys are your field names, values are the CKAN parameter names.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Secret Name (for API Key) *</Label>
              <Input value={form.api_key_secret_name} onChange={(e) => setForm({ ...form, api_key_secret_name: e.target.value })} placeholder="ASIC_API_KEY" className="font-mono" />
              <p className="text-xs text-muted-foreground">An identifier for this API key</p>
            </div>
            <div className="space-y-2">
              <Label>API Key Value</Label>
              <Input
                type="password"
                value={form.api_key_value}
                onChange={(e) => setForm({ ...form, api_key_value: e.target.value })}
                placeholder={editConfig?.api_key_value ? "••••••••••••••••" : "Enter API key"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {form.registry_type === "ckan"
                  ? "CKAN portals often don't require an API key for public data – leave blank if not needed"
                  : editConfig?.api_key_value
                    ? "Leave blank to keep the existing key, or enter a new value to update it"
                    : "Paste the API key provided by the registry"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Capabilities</Label>
              <div className="flex flex-wrap gap-2">
                {REGISTRY_CAPABILITIES.map((cap) => (
                  <Badge
                    key={cap}
                    variant={form.capabilities.includes(cap) ? "default" : "outline"}
                    className="cursor-pointer text-xs capitalize"
                    onClick={() => {
                      setForm({
                        ...form,
                        capabilities: form.capabilities.includes(cap)
                          ? form.capabilities.filter((c) => c !== cap)
                          : [...form.capabilities, cap],
                      });
                    }}
                  >
                    {cap.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveConfig}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
