import { useState } from "react";
import { BrandingSettings } from "@/components/branding/BrandingSettings";
import { LabellingModeSelector } from "@/components/branding/LabellingModeSelector";
import { useBranding } from "@/components/branding/BrandingProvider";
import { LabellingMode } from "@/lib/branding-types";
import { ResponsiveLayout, NavSection } from "@/components/layout/ResponsiveSidebar";
import { LayoutDashboard, Palette, Users, FileText, Settings } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const sections: NavSection[] = [
  {
    label: "Portal",
    items: [
      { title: "Dashboard", url: "/originator", icon: LayoutDashboard },
      { title: "Borrowers", url: "/originator/borrowers", icon: Users },
      { title: "Reports", url: "/originator/reports", icon: FileText },
      { title: "Branding", url: "/originator/branding", icon: Palette },
      { title: "Settings", url: "/originator/settings", icon: Settings },
    ],
  },
];

export default function OriginatorBranding() {
  const { branding, setBranding } = useBranding();
  const [mode, setMode] = useState<LabellingMode>(branding.labellingMode);

  const handleModeChange = (newMode: LabellingMode) => {
    setMode(newMode);
    setBranding({ ...branding, labellingMode: newMode });
  };

  // Originators can't change their own labelling mode — Vybrel admin sets it
  const isAdmin = false; // TODO: Check if user has Vybrel admin role

  return (
    <ResponsiveLayout sections={sections} portalTitle="Originator Portal">
      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="branding">Brand Settings</TabsTrigger>
          <TabsTrigger value="labelling">Labelling Mode</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <BrandingSettings />
        </TabsContent>

        <TabsContent value="labelling">
          <LabellingModeSelector
            value={mode}
            onChange={handleModeChange}
            disabled={!isAdmin}
          />
        </TabsContent>
      </Tabs>
    </ResponsiveLayout>
  );
}
