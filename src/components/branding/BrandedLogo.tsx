import { useBranding } from "./BrandingProvider";

interface BrandedLogoProps {
  collapsed?: boolean;
  className?: string;
}

export function BrandedLogo({ collapsed = false, className }: BrandedLogoProps) {
  const { branding, isWhiteLabel, isJointLabel, isPlatformLabel } = useBranding();

  if (isPlatformLabel) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            V
          </div>
          {!collapsed && <span className="text-lg font-bold text-sidebar-foreground">Vybrel</span>}
        </div>
      </div>
    );
  }

  const logoSrc = collapsed ? branding.logoIconUrl || branding.logoUrl : branding.logoUrl;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={branding.organizationName}
            className={collapsed ? "h-8 w-8 rounded-lg object-contain" : "h-8 max-w-[140px] object-contain"}
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            {branding.organizationName.charAt(0)}
          </div>
        )}
        {!collapsed && !logoSrc && (
          <span className="text-lg font-bold text-sidebar-foreground">{branding.organizationName}</span>
        )}
      </div>
      {isJointLabel && !collapsed && (
        <p className="mt-1 text-[10px] text-sidebar-foreground/50">Powered by Vybrel</p>
      )}
    </div>
  );
}

export function PoweredByBadge({ className }: { className?: string }) {
  const { showVybrelBadge, isPlatformLabel } = useBranding();

  if (!showVybrelBadge || isPlatformLabel) return null;

  return (
    <div className={`flex items-center justify-center gap-1.5 text-xs text-muted-foreground ${className || ""}`}>
      <span>Powered by</span>
      <span className="font-semibold">Vybrel</span>
    </div>
  );
}
