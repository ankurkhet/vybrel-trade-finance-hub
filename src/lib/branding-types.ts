/**
 * Branding configuration types for the white-label system.
 * 
 * Three labelling modes (set by Vybrel admin during originator onboarding):
 * - "white_label"   → Full originator branding, no Vybrel mention
 * - "joint_label"   → Originator branding + "Powered by Vybrel" badge
 * - "platform_label" → Standard Vybrel branding throughout
 */

export type LabellingMode = "white_label" | "joint_label" | "platform_label";

export interface BrandingColors {
  primary: string;       // HSL format: "217 91% 40%"
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
}

export interface BrandingConfig {
  organizationId: string;
  organizationName: string;
  labellingMode: LabellingMode;
  logoUrl?: string;
  logoIconUrl?: string;        // Small icon for collapsed sidebar / favicon
  faviconUrl?: string;
  colors: BrandingColors;
  fontFamily?: string;         // Google Font name e.g. "Inter", "DM Sans"
  customDomain?: string;       // e.g. "finance.acmecorp.com"
  emailFromName?: string;      // Sender name for emails
  emailFooterText?: string;    // Custom footer in transactional emails
  loginWelcomeText?: string;   // Custom text on login page
  supportEmail?: string;
  supportPhone?: string;
}

export const DEFAULT_VYBREL_BRANDING: BrandingConfig = {
  organizationId: "vybrel",
  organizationName: "Vybrel",
  labellingMode: "platform_label",
  colors: {
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
  },
};

export const BRANDING_COLOR_FIELDS: { key: keyof BrandingColors; label: string; description: string }[] = [
  { key: "primary", label: "Primary", description: "Buttons, links, active states" },
  { key: "primaryForeground", label: "Primary Text", description: "Text on primary backgrounds" },
  { key: "secondary", label: "Secondary", description: "Secondary buttons, subtle backgrounds" },
  { key: "secondaryForeground", label: "Secondary Text", description: "Text on secondary backgrounds" },
  { key: "accent", label: "Accent", description: "Highlights, hover states" },
  { key: "accentForeground", label: "Accent Text", description: "Text on accent backgrounds" },
  { key: "sidebar", label: "Sidebar", description: "Sidebar background color" },
  { key: "sidebarForeground", label: "Sidebar Text", description: "Sidebar text color" },
  { key: "sidebarAccent", label: "Sidebar Accent", description: "Active item in sidebar" },
  { key: "sidebarAccentForeground", label: "Sidebar Accent Text", description: "Active item text in sidebar" },
];
