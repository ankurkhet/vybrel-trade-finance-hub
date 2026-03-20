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
import { Loader2, Plus, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Globe, Key, Settings2, Database } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_REGISTRIES, REGISTRY_CAPABILITIES } from "@/lib/onboarding-types";

export default function RegistryApis() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<any>(null);
  const [testing, setTesting] = useState<string | null>(null);

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

  useEffect(() => { fetchConfigs(); }, []);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Registry API Management</h1>
            <p className="text-sm text-muted-foreground">Configure company registry APIs for KYB verification</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={seedDefaults}>
              <Globe className="mr-2 h-4 w-4" /> Seed Defaults
            </Button>
            <Button onClick={() => { setEditConfig(null); setForm({ ...emptyForm }); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Registry
            </Button>
          </div>
        </div>

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

                    const hasCap = (c: any, caps: string[]) =>
                      (c.capabilities || []).some((cap: string) => caps.includes(cap));

                    const categorize = (c: any): string => {
                      if (hasCap(c, SANCTIONS_CAPS)) return "Sanctions Screening";
                      if (hasCap(c, BANK_CAPS)) return "Bank Account Validation";
                      if (hasCap(c, FINANCIAL_CAPS)) return "Financial Inputs";
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

                    const sectionOrder = ["Company Registries", "Financial Inputs", "Sanctions Screening", "Bank Account Validation"];
                    const grouped: Record<string, any[]> = {};
                    for (const c of sortedConfigs) {
                      const cat = categorize(c);
                      if (!grouped[cat]) grouped[cat] = [];
                      grouped[cat].push(c);
                    }

                    const renderRows = (items: any[]) => items.map((c) => (
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
                    ));

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
