import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useBranding } from "./BrandingProvider";
import { BrandedLogo, PoweredByBadge } from "./BrandedLogo";
import { BrandingColors, BRANDING_COLOR_FIELDS } from "@/lib/branding-types";
import { Palette, Type, Image, Eye, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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

export function BrandingSettings() {
  const { branding, setBranding } = useBranding();
  const [draft, setDraft] = useState({ ...branding });

  const updateColor = useCallback((key: keyof BrandingColors, hex: string) => {
    setDraft((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: hexToHsl(hex) },
    }));
  }, []);

  const handleSave = () => {
    setBranding(draft);
    toast({ title: "Branding saved", description: "Your brand settings have been updated." });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Brand Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customize how your portal looks to borrowers and funders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {draft.labellingMode.replace("_", " ")}
          </Badge>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="identity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="identity" className="gap-2">
            <Image className="h-4 w-4" /> Identity
          </TabsTrigger>
          <TabsTrigger value="colors" className="gap-2">
            <Palette className="h-4 w-4" /> Colors
          </TabsTrigger>
          <TabsTrigger value="typography" className="gap-2">
            <Type className="h-4 w-4" /> Typography
          </TabsTrigger>
          <TabsTrigger value="preview" className="gap-2">
            <Eye className="h-4 w-4" /> Preview
          </TabsTrigger>
        </TabsList>

        {/* Identity Tab */}
        <TabsContent value="identity">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brand Identity</CardTitle>
              <CardDescription>Upload your logo and set your organization details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Organization Name</Label>
                  <Input
                    value={draft.organizationName}
                    onChange={(e) => setDraft({ ...draft, organizationName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custom Domain</Label>
                  <Input
                    placeholder="finance.yourcompany.com"
                    value={draft.customDomain || ""}
                    onChange={(e) => setDraft({ ...draft, customDomain: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Logo URL (Full)</Label>
                  <Input
                    placeholder="https://..."
                    value={draft.logoUrl || ""}
                    onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Recommended: 200×50px, PNG/SVG with transparency</p>
                </div>
                <div className="space-y-2">
                  <Label>Logo Icon (Small)</Label>
                  <Input
                    placeholder="https://..."
                    value={draft.logoIconUrl || ""}
                    onChange={(e) => setDraft({ ...draft, logoIconUrl: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Square icon for collapsed sidebar / favicon, 64×64px</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Login Welcome Text</Label>
                  <Input
                    placeholder="Welcome to our financing portal"
                    value={draft.loginWelcomeText || ""}
                    onChange={(e) => setDraft({ ...draft, loginWelcomeText: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input
                    placeholder="support@yourcompany.com"
                    value={draft.supportEmail || ""}
                    onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Colors Tab */}
        <TabsContent value="colors">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Brand Colors</CardTitle>
              <CardDescription>Set your brand colors — these will be applied across the entire portal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {BRANDING_COLOR_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-3 rounded-lg border p-3">
                    <input
                      type="color"
                      value={hslToHex(draft.colors[field.key])}
                      onChange={(e) => updateColor(field.key, e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded-md border-0 p-0"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{field.label}</p>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    </div>
                    <code className="hidden text-xs text-muted-foreground sm:block">
                      {draft.colors[field.key]}
                    </code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Typography Tab */}
        <TabsContent value="typography">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Typography</CardTitle>
              <CardDescription>Choose a Google Font for your portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Input
                  placeholder="e.g. Inter, DM Sans, Outfit"
                  value={draft.fontFamily || ""}
                  onChange={(e) => setDraft({ ...draft, fontFamily: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Enter a Google Fonts family name. Leave empty for system default.</p>
              </div>
              <div className="space-y-2">
                <Label>Email Sender Name</Label>
                <Input
                  placeholder="e.g. Acme Finance Team"
                  value={draft.emailFromName || ""}
                  onChange={(e) => setDraft({ ...draft, emailFromName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Footer Text</Label>
                <Input
                  placeholder="Custom footer text for transactional emails"
                  value={draft.emailFooterText || ""}
                  onChange={(e) => setDraft({ ...draft, emailFooterText: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live Preview</CardTitle>
              <CardDescription>See how your branding will appear to users</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sidebar preview */}
              <div className="overflow-hidden rounded-xl border">
                <div className="flex">
                  <div
                    className="w-56 p-4 space-y-4"
                    style={{ backgroundColor: `hsl(${draft.colors.sidebar})`, color: `hsl(${draft.colors.sidebarForeground})` }}
                  >
                    <BrandedLogo />
                    <div className="space-y-1">
                      {["Dashboard", "Transactions", "Reports", "Settings"].map((item, i) => (
                        <div
                          key={item}
                          className="rounded-md px-3 py-2 text-sm"
                          style={
                            i === 0
                              ? { backgroundColor: `hsl(${draft.colors.sidebarAccent})`, color: `hsl(${draft.colors.sidebarAccentForeground})` }
                              : {}
                          }
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                    <PoweredByBadge className="mt-auto pt-4" />
                  </div>
                  <div className="flex-1 bg-background p-6">
                    <h3 className="text-lg font-bold text-foreground">Dashboard</h3>
                    <p className="text-sm text-muted-foreground mt-1">Welcome to {draft.organizationName}</p>
                    <div className="mt-4 flex gap-2">
                      <button
                        className="rounded-md px-4 py-2 text-sm font-medium"
                        style={{ backgroundColor: `hsl(${draft.colors.primary})`, color: `hsl(${draft.colors.primaryForeground})` }}
                      >
                        Primary Action
                      </button>
                      <button
                        className="rounded-md px-4 py-2 text-sm font-medium"
                        style={{ backgroundColor: `hsl(${draft.colors.secondary})`, color: `hsl(${draft.colors.secondaryForeground})` }}
                      >
                        Secondary
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Login preview */}
              <div className="rounded-xl border bg-background p-8">
                <div className="mx-auto max-w-xs space-y-4 text-center">
                  {draft.logoUrl ? (
                    <img src={draft.logoUrl} alt="Logo" className="mx-auto h-10 object-contain" />
                  ) : (
                    <div
                      className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold"
                      style={{ backgroundColor: `hsl(${draft.colors.primary})`, color: `hsl(${draft.colors.primaryForeground})` }}
                    >
                      {draft.organizationName.charAt(0)}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {draft.loginWelcomeText || `Sign in to ${draft.organizationName}`}
                  </p>
                  <div className="space-y-2">
                    <div className="h-10 rounded-md border bg-muted/30" />
                    <div className="h-10 rounded-md border bg-muted/30" />
                    <div
                      className="h-10 rounded-md flex items-center justify-center text-sm font-medium"
                      style={{ backgroundColor: `hsl(${draft.colors.primary})`, color: `hsl(${draft.colors.primaryForeground})` }}
                    >
                      Sign In
                    </div>
                  </div>
                  {draft.labellingMode === "joint_label" && (
                    <p className="text-[10px] text-muted-foreground">Powered by Vybrel</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
