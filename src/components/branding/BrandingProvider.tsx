import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { BrandingConfig, DEFAULT_VYBREL_BRANDING, LabellingMode } from "@/lib/branding-types";

interface BrandingContextValue {
  branding: BrandingConfig;
  setBranding: (config: BrandingConfig) => void;
  isWhiteLabel: boolean;
  isJointLabel: boolean;
  isPlatformLabel: boolean;
  showVybrelBadge: boolean;
}

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_VYBREL_BRANDING,
  setBranding: () => {},
  isWhiteLabel: false,
  isJointLabel: false,
  isPlatformLabel: true,
  showVybrelBadge: false,
});

export function useBranding() {
  return useContext(BrandingContext);
}

function applyBrandingCSS(config: BrandingConfig) {
  const root = document.documentElement;
  const c = config.colors;

  root.style.setProperty("--primary", c.primary);
  root.style.setProperty("--primary-foreground", c.primaryForeground);
  root.style.setProperty("--secondary", c.secondary);
  root.style.setProperty("--secondary-foreground", c.secondaryForeground);
  root.style.setProperty("--accent", c.accent);
  root.style.setProperty("--accent-foreground", c.accentForeground);
  root.style.setProperty("--sidebar-background", c.sidebar);
  root.style.setProperty("--sidebar-foreground", c.sidebarForeground);
  root.style.setProperty("--sidebar-accent", c.sidebarAccent);
  root.style.setProperty("--sidebar-accent-foreground", c.sidebarAccentForeground);

  // Apply sidebar-derived tokens
  root.style.setProperty("--sidebar-primary", c.primary);
  root.style.setProperty("--sidebar-primary-foreground", c.primaryForeground);

  // Update page title
  if (config.labellingMode === "white_label") {
    document.title = config.organizationName;
  } else if (config.labellingMode === "joint_label") {
    document.title = `${config.organizationName} | Powered by Vybrel`;
  } else {
    document.title = "Vybrel - Invoice Financing Platform";
  }

  // Update favicon if provided
  if (config.faviconUrl) {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = config.faviconUrl;
    } else {
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = config.faviconUrl;
      document.head.appendChild(link);
    }
  }
}

function clearBrandingCSS() {
  const root = document.documentElement;
  const props = [
    "--primary", "--primary-foreground", "--secondary", "--secondary-foreground",
    "--accent", "--accent-foreground", "--sidebar-background", "--sidebar-foreground",
    "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-primary", "--sidebar-primary-foreground",
  ];
  props.forEach((p) => root.style.removeProperty(p));
}

interface BrandingProviderProps {
  children: ReactNode;
  initialConfig?: BrandingConfig;
}

export function BrandingProvider({ children, initialConfig }: BrandingProviderProps) {
  const [branding, setBrandingState] = useState<BrandingConfig>(
    initialConfig || DEFAULT_VYBREL_BRANDING
  );

  const setBranding = (config: BrandingConfig) => {
    setBrandingState(config);
    // TODO: Persist to Supabase organizations table
  };

  useEffect(() => {
    applyBrandingCSS(branding);
    return () => clearBrandingCSS();
  }, [branding]);

  const mode = branding.labellingMode;

  return (
    <BrandingContext.Provider
      value={{
        branding,
        setBranding,
        isWhiteLabel: mode === "white_label",
        isJointLabel: mode === "joint_label",
        isPlatformLabel: mode === "platform_label",
        showVybrelBadge: mode === "joint_label" || mode === "platform_label",
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}
