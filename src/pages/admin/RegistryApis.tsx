import { useState, useEffect } from "react";
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
import { Loader2, Plus, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Globe, Key, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_REGISTRIES, REGISTRY_CAPABILITIES, COUNTRIES } from "@/lib/onboarding-types";

export default function RegistryApis() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<any>(null);
  const [testing, setTesting] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    country_code: "",
    country_name: "",
    registry_name: "",
    api_base_url: "",
    api_key_secret_name: "",
    api_key_value: "",
    capabilities: [] as string[],
  });

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
    if (editConfig) {
      await supabase.from("registry_api_configs").update(form).eq("id", editConfig.id);
    } else {
      await supabase.from("registry_api_configs").insert(form);
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
      api_base_url: config.api_base_url,
      api_key_secret_name: config.api_key_secret_name,
      api_key_value: config.api_key_value || "",
      capabilities: config.capabilities || [],
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
            <Button onClick={() => { setEditConfig(null); setForm({ country_code: "", country_name: "", registry_name: "", api_base_url: "", api_key_secret_name: "", api_key_value: "", capabilities: [] }); setDialogOpen(true); }}>
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
                    <TableHead>Registry</TableHead>
                    <TableHead>Secret Name</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.country_name}</TableCell>
                      <TableCell className="text-sm">{c.registry_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono"><Key className="mr-1 h-3 w-3" />{c.api_key_secret_name}</Badge>
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
                  ))}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editConfig ? "Edit Registry" : "Add Registry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country Code *</Label>
                <Input value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })} placeholder="GB" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>Country Name *</Label>
                <Input value={form.country_name} onChange={(e) => setForm({ ...form, country_name: e.target.value })} placeholder="United Kingdom" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Registry Name *</Label>
              <Input value={form.registry_name} onChange={(e) => setForm({ ...form, registry_name: e.target.value })} placeholder="Companies House" />
            </div>
            <div className="space-y-2">
              <Label>API Base URL</Label>
              <Input value={form.api_base_url} onChange={(e) => setForm({ ...form, api_base_url: e.target.value })} placeholder="https://api.example.com" />
            </div>
            <div className="space-y-2">
              <Label>Secret Name (for API Key) *</Label>
              <Input value={form.api_key_secret_name} onChange={(e) => setForm({ ...form, api_key_secret_name: e.target.value })} placeholder="COMPANIES_HOUSE_API_KEY" className="font-mono" />
              <p className="text-xs text-muted-foreground">This must match the secret name configured in the platform</p>
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
