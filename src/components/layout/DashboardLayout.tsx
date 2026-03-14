import { ReactNode, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  BarChart3,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  CreditCard,
  Upload,
  Brain,
  Palette,
  Hexagon,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, profile, roles, signOut, isAdmin, isOriginatorAdmin, isBorrower, isFunder } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase()
    : "U";

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", show: true },
    // Admin
    { icon: Building2, label: "Organizations", path: "/admin/organizations", show: isAdmin },
    { icon: Users, label: "All Users", path: "/admin/users", show: isAdmin },
    { icon: BarChart3, label: "Platform Reports", path: "/admin/reports", show: isAdmin },
    // Originator
    { icon: Users, label: "Borrowers", path: "/originator/borrowers", show: isOriginatorAdmin },
    { icon: FileText, label: "Contracts", path: "/originator/contracts", show: isOriginatorAdmin },
    { icon: CreditCard, label: "Invoices", path: "/originator/invoices", show: isOriginatorAdmin },
    { icon: Brain, label: "AI Insights", path: "/originator/ai-insights", show: isOriginatorAdmin },
    { icon: Upload, label: "KYC/KYB Docs", path: "/originator/documents", show: isOriginatorAdmin },
    { icon: BarChart3, label: "Reports", path: "/originator/reports", show: isOriginatorAdmin },
    { icon: Palette, label: "Branding", path: "/originator/branding", show: isOriginatorAdmin },
    // Borrower
    { icon: Upload, label: "My Documents", path: "/borrower/documents", show: isBorrower },
    { icon: CreditCard, label: "My Invoices", path: "/borrower/invoices", show: isBorrower },
    { icon: BarChart3, label: "My Reports", path: "/borrower/reports", show: isBorrower },
    // Funder
    { icon: BarChart3, label: "Portfolio", path: "/funder/reports", show: isFunder },
    // Common
    { icon: Shield, label: "Security", path: "/settings/security", show: true },
    { icon: Settings, label: "Settings", path: "/settings", show: true },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <Hexagon className="h-5 w-5 text-sidebar-primary" strokeWidth={1.5} />
          <span className="text-lg font-semibold tracking-tight">Vybrel</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                location.pathname === item.path
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">{profile?.full_name || "User"}</p>
              <p className="truncate text-xs text-sidebar-foreground/50">{roles[0] || "user"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
