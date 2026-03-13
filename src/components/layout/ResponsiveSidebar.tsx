import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileTabBar, TabItem } from "./MobileTabBar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

export interface NavSection {
  label: string;
  items: {
    title: string;
    url: string;
    icon: LucideIcon;
  }[];
}

interface ResponsiveSidebarProps {
  sections: NavSection[];
  header?: ReactNode;
  children: ReactNode;
  portalTitle: string;
}

function SidebarNav({ sections, header }: { sections: NavSection[]; header?: ReactNode }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      {header && <SidebarHeader>{header}</SidebarHeader>}
      <SidebarContent>
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <NavLink
                        to={item.url}
                        end
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export function ResponsiveLayout({ sections, header, children, portalTitle }: ResponsiveSidebarProps) {
  const isMobile = useIsMobile();

  // Flatten all items for mobile tab bar (take first 5)
  const tabItems: TabItem[] = sections
    .flatMap((s) => s.items)
    .slice(0, 5)
    .map((i) => ({ title: i.title, url: i.url, icon: i.icon }));

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {!isMobile && <SidebarNav sections={sections} header={header} />}

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-card px-4">
            {!isMobile && <SidebarTrigger />}
            <h1 className="text-lg font-semibold text-foreground">{portalTitle}</h1>
          </header>

          <main className={`flex-1 p-4 md:p-6 ${isMobile ? "pb-20" : ""}`}>
            {children}
          </main>
        </div>

        {isMobile && <MobileTabBar items={tabItems} />}
      </div>
    </SidebarProvider>
  );
}
