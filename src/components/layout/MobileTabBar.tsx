import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface TabItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface MobileTabBarProps {
  items: TabItem[];
  className?: string;
}

export function MobileTabBar({ items, className }: MobileTabBarProps) {
  return (
    <nav
      className={cn(
        "mobile-tab-bar fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-card px-2 py-1 md:hidden",
        className
      )}
    >
      {items.slice(0, 5).map((item) => (
        <NavLink
          key={item.url}
          to={item.url}
          className="flex flex-col items-center gap-0.5 px-2 py-1.5 text-muted-foreground transition-colors"
          activeClassName="text-primary"
        >
          <item.icon className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-tight">{item.title}</span>
        </NavLink>
      ))}
    </nav>
  );
}
