import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Palette, Plus, Loader2, Upload, Trash2, Star, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BRANDING_COLOR_FIELDS, BrandingColors } from "@/lib/branding-types";

const DEFAULT_COLORS: BrandingColors = {
  primary: "217 91% 40%",
  primaryForeground: "0 0% 100%",
  secondary: "210 40% 96%",
  secondaryForeground: "222 47% 11%",
  accent: "210 40% 96%",
  accentForeground: "222 47% 11%",
  sidebar: "222 47% 11%",
  sidebarForeground: "210 40% 96%",
  sidebarAccent: "222 47% 16%",
  sidebarAccentForeground: "210 40% 96%",
};

function hslToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/).map(Number);
  if (parts.length !== 3) return "#000000";
  const [h, s, l] = [parts[0], parts[1] / 100, parts[2] / 100];
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0 0% 0%";
  let [r, g, b] = [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function BrandingProfiles() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const iconRef = useRef<HTMLInputElement>(null);

  // Form
  const [profileName, setProfileName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoIconUrl, setLogoIconUrl] = useState("");
  const [fontFamily, setFontFamily] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [loginWelcomeText, setLoginWelcomeText] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [emailFromName, setEmailFromName] = useState("");
  const [colors, setColors] = useState<BrandingColors>({ ...DEFAULT_COLORS });

  const orgId = profile?.organization_id;

  useEffect(() => {
    if (orgId) fetchProfiles();
  }, [orgId]);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("branding_profiles")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    setProfiles(data || []);
    setLoading(false);
  };

  const openEdit = (p: any) => {
    setEditProfile(p);
    setProfileName(p.profile_name);
    setLogoUrl(p.logo_url || "");
    setLogoIconUrl(p.logo_icon_url || "");
    setFontFamily(p.font_family || "");
    setCustomDomain(p.custom_domain || "");
    setLoginWelcomeText(p.login_welcome_text || "");
    setSupportEmail(p.support_email || "");
    setEmailFromName(p.email_from_name || "");
    const c = p.colors || {};
    setColors({ ...DEFAULT_COLORS, ...c });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditProfile(null);
    setProfileName("");
    setLogoUrl("");
    setLogoIconUrl("");
    setFontFamily("");
    setCustomDomain("");
    setLoginWelcomeText("");
    setSupportEmail("");
    setEmailFromName("");
    setColors({ ...DEFAULT_COLORS });
    setDialogOpen(true);
  };

  const uploadFile = async (file: File, type: "logo" | "icon") => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${orgId}/${type}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("branding-assets").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("branding-assets").getPublicUrl(path);
    if (type === "logo") setLogoUrl(urlData.publicUrl);
    else setLogoIconUrl(urlData.publicUrl);
    toast.success(`${type === "logo" ? "Logo" : "Icon"} uploaded`);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!profileName) { toast.error("Profile name is required"); return; }
    setSubmitting(true);
    const payload = {
      organization_id: orgId,
      profile_name: profileName,
      logo_url: logoUrl || null,
      logo_icon_url: logoIconUrl || null,
      colors: colors as unknown as Record<string, string>,
      font_family: fontFamily || null,
      custom_domain: customDomain || null,
      login_welcome_text: loginWelcomeText || null,
      support_email: supportEmail || null,
      email_from_name: emailFromName || null,
    };

    if (editProfile) {
      const { error } = await supabase.from("branding_profiles").update(payload).eq("id", editProfile.id);
      if (error) toast.error(error.message);
      else { toast.success("Profile updated"); setDialogOpen(false); fetchProfiles(); }
    } else {
      const { error } = await supabase.from("branding_profiles").insert(payload);
      if (error) toast.error(error.message);
      else { toast.success("Profile created"); setDialogOpen(false); fetchProfiles(); }
    }
    setSubmitting(false);
  };

  const handleActivate = async (id: string) => {
    // Deactivate all, then activate selected
    await supabase.from("branding_profiles").update({ is_active: false }).eq("organization_id", orgId);
    await supabase.from("branding_profiles").update({ is_active: true }).eq("id", id);
    toast.success("Branding profile activated");
    fetchProfiles();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("branding_profiles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Profile deleted"); fetchProfiles(); }
  };

  const updateColor = (key: keyof BrandingColors, hex: string) => {
    setColors((prev) => ({ ...prev, [key]: hexToHsl(hex) }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Branding Profiles</h1>
            <p className="text-sm text-muted-foreground">Create and manage multiple brand configurations</p>
          </div>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Profile</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : profiles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <Palette className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No branding profiles yet. Create your first one!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((p) => (
              <Card key={p.id} className={p.is_active ? "ring-2 ring-primary" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{p.profile_name}</CardTitle>
                    {p.is_active && <Badge variant="default" className="text-xs"><Star className="mr-1 h-3 w-3" /> Active</Badge>}
                  </div>
                  <CardDescription className="text-xs">{p.custom_domain || "No custom domain"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Logo preview */}
                  <div className="h-12 flex items-center">
                    {p.logo_url ? (
                      <img src={p.logo_url} alt="Logo" className="h-10 max-w-[120px] object-contain" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                        {p.profile_name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Color swatches */}
                  <div className="flex gap-1">
                    {["primary", "secondary", "accent", "sidebar"].map((key) => (
                      <div
                        key={key}
                        className="h-6 w-6 rounded-full border"
                        style={{ backgroundColor: `hsl(${(p.colors as any)?.[key] || "0 0% 50%"})` }}
                        title={key}
                      />
                    ))}
                  </div>

                  <div className="flex gap-2 pt-2">
                    {!p.is_active && (
                      <Button size="sm" variant="outline" onClick={() => handleActivate(p.id)}>Activate</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProfile ? "Edit" : "Create"} Branding Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-2">
            {/* Identity */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Identity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Profile Name *</Label>
                  <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="e.g. Default, Partner Portal" />
                </div>
                <div className="space-y-2">
                  <Label>Custom Domain</Label>
                  <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="finance.company.com" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Logos */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Logos</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Logo</Label>
                  <div className="flex gap-2">
                    <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="URL or upload" className="flex-1" />
                    <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "logo")} />
                    <Button variant="outline" size="icon" onClick={() => logoRef.current?.click()} disabled={uploading}>
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                  {logoUrl && <img src={logoUrl} alt="Logo preview" className="h-10 max-w-[140px] object-contain rounded border p-1" />}
                </div>
                <div className="space-y-2">
                  <Label>Icon (64×64)</Label>
                  <div className="flex gap-2">
                    <Input value={logoIconUrl} onChange={(e) => setLogoIconUrl(e.target.value)} placeholder="URL or upload" className="flex-1" />
                    <input ref={iconRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], "icon")} />
                    <Button variant="outline" size="icon" onClick={() => iconRef.current?.click()} disabled={uploading}>
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                  {logoIconUrl && <img src={logoIconUrl} alt="Icon preview" className="h-10 w-10 object-contain rounded border p-1" />}
                </div>
              </div>
            </div>

            <Separator />

            {/* Colors */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Colors</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {BRANDING_COLOR_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-3 rounded-lg border p-2">
                    <input
                      type="color"
                      value={hslToHex(colors[field.key])}
                      onChange={(e) => updateColor(field.key, e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border-0 p-0"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">{field.label}</p>
                      <p className="text-[10px] text-muted-foreground">{field.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Additional settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Additional</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <Input value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} placeholder="Inter, DM Sans" />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@company.com" />
                </div>
                <div className="space-y-2">
                  <Label>Email Sender Name</Label>
                  <Input value={emailFromName} onChange={(e) => setEmailFromName(e.target.value)} placeholder="Acme Finance" />
                </div>
                <div className="space-y-2">
                  <Label>Login Welcome Text</Label>
                  <Input value={loginWelcomeText} onChange={(e) => setLoginWelcomeText(e.target.value)} placeholder="Welcome to our portal" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editProfile ? "Save Changes" : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
