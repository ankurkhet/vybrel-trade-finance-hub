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
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Hexagon,
  Package,
  Banknote,
  Wallet,
  FileCheck,
  Receipt,
  ArrowDownUp,
  MessageSquare,
  Handshake,
  HelpCircle,
  Layers,
  UserCog,
  TrendingUp,
  Landmark,
} from "lucide-react";
import { Gavel, Workflow, Globe, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, profile, roles, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Determine highest role
  const ROLE_HIERARCHY = ["admin", "originator_admin", "broker_admin", "funder", "borrower", "account_manager", "operations_manager", "credit_committee_member", "originator_user"];
  const sortedRoles = [...roles].sort((a, b) => {
    const idxA = ROLE_HIERARCHY.indexOf(a);
    const idxB = ROLE_HIERARCHY.indexOf(b);
    return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
  });
  
  const [activeRole, setActiveRoleState] = useState<string>(() => {
    const saved = sessionStorage.getItem("vybrel_active_role");
    if (saved && (roles as string[]).includes(saved)) return saved;
    return sortedRoles[0] || "user";
  });

  const setActiveRole = (role: string) => {
    setActiveRoleState(role);
    sessionStorage.setItem("vybrel_active_role", role);
  };

  const roleLabels: Record<string, string> = {
    admin: "Vybrel Admin",
    originator_admin: "Originator Admin",
    broker_admin: "Broker Admin",
    funder: "Funder",
    borrower: "Borrower",
    account_manager: "Originator: Account Manager",
    operations_manager: "Originator: Operations Mngr",
    credit_committee_member: "Originator: Credit Committee",
    originator_user: "Originator User",
  };
  const activeRoleLabel = roleLabels[activeRole] || activeRole;

  const handleSignOut = async () => {
    sessionStorage.removeItem("vybrel_active_role");
    await signOut();
    navigate("/auth");
  };

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase()
    : "U";

  type NavItem = { icon: any; label: string; path: string; show: boolean; section?: string };

  const isOriginator = ["originator_admin", "account_manager", "operations_manager", "credit_committee_member", "originator_user"].includes(activeRole);

  const navItems: NavItem[] = [
    // ── Common top ────────────────────────────────────────────────
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", show: true, section: "Main" },
    { icon: MessageSquare, label: "Messages", path: "/messages", show: true },

    // ── Vybrel Admin ─────────────────────────────────────────────
    { icon: Building2, label: "Originators", path: "/admin/organizations", show: activeRole === "admin", section: "Platform Admin" },
    { icon: Users, label: "All Users", path: "/admin/users", show: activeRole === "admin" },
    { icon: BarChart3, label: "Platform Reports", path: "/admin/reports", show: activeRole === "admin" },
    { icon: Package, label: "Products", path: "/admin/products", show: activeRole === "admin" },
    { icon: Shield, label: "Audit Logs", path: "/admin/audit-logs", show: activeRole === "admin" },
    { icon: Workflow, label: "Workflow Studio", path: "/admin/workflow-studio", show: activeRole === "admin" },
    { icon: Globe, label: "Registry APIs", path: "/admin/registry-apis", show: activeRole === "admin" },

    // ── Originator — 13 items ────────────────────────────────────
    { icon: UserCog,   label: "Users",            path: "/originator/users",             show: activeRole === "originator_admin", section: "Originator" },
    { icon: Users,     label: "Borrowers",         path: "/originator/borrowers",         show: isOriginator },
    { icon: Landmark,  label: "Funders",            path: "/originator/lender-management", show: activeRole === "originator_admin" },
    { icon: Handshake, label: "Brokers",            path: "/originator/brokers",           show: activeRole === "originator_admin" },
    { icon: FileText,  label: "Invoices & Funding", path: "/originator/invoices",          show: isOriginator },
    { icon: Gavel,     label: "Credit Committee",   path: "/originator/credit-committee",  show: ["originator_admin", "credit_committee_member"].includes(activeRole) },
    { icon: Banknote,  label: "Disbursements",      path: "/originator/disbursements",     show: ["originator_admin", "operations_manager"].includes(activeRole) },
    { icon: Receipt,   label: "Collections",        path: "/originator/collections",       show: ["originator_admin", "operations_manager"].includes(activeRole) },
    { icon: TrendingUp,label: "Settlements",        path: "/originator/settlements",       show: ["originator_admin", "operations_manager"].includes(activeRole) },
    { icon: Scale,     label: "Reconciliation",     path: "/originator/reconciliation",    show: ["originator_admin", "operations_manager"].includes(activeRole) },
    { icon: FileCheck, label: "Offer Letters",      path: "/originator/offer-letters",     show: activeRole === "originator_admin" },
    { icon: BarChart3, label: "Reports",            path: "/originator/reports",           show: activeRole === "originator_admin" },
    { icon: Layers,    label: "Platform Settings",  path: "/originator/platform-settings", show: activeRole === "originator_admin" },

    // ── Broker ───────────────────────────────────────────────────
    { icon: Users,     label: "Borrowers",  path: "/broker/borrowers",   show: activeRole === "broker_admin", section: "Broker" },
    { icon: FileText,  label: "Contracts",  path: "/broker/contracts",   show: activeRole === "broker_admin" },
    { icon: FileText,  label: "Invoices",   path: "/broker/invoices",    show: activeRole === "broker_admin" },
    { icon: Receipt,   label: "Collections",path: "/broker/collections", show: activeRole === "broker_admin" },
    { icon: BarChart3, label: "Reports",    path: "/broker/reports",     show: activeRole === "broker_admin" },

    // ── Borrower ─────────────────────────────────────────────────
    { icon: Building2, label: "My Profile",     path: "/borrower/profile",       show: activeRole === "borrower", section: "Borrower" },
    { icon: FileCheck, label: "Onboarding",     path: "/borrower/onboarding",    show: activeRole === "borrower" },
    { icon: FileText,  label: "My Invoices",    path: "/borrower/invoices",      show: activeRole === "borrower" },
    { icon: FileCheck, label: "Verify Invoices",path: "/counterparty/dashboard", show: activeRole === "borrower" },
    { icon: Receipt,   label: "Settlements",    path: "/borrower/settlements",   show: activeRole === "borrower" },
    { icon: BarChart3, label: "My Reports",     path: "/borrower/reports",       show: activeRole === "borrower" },
    { icon: FileText,  label: "Offer Letters",  path: "/borrower/offer-letters", show: activeRole === "borrower" },

    // ── Funder ───────────────────────────────────────────────────
    { icon: Shield,    label: "Onboarding & KYC", path: "/funder/onboarding", show: activeRole === "funder", section: "Funder" },
    { icon: Banknote,  label: "Marketplace",      path: "/funder/marketplace", show: activeRole === "funder" },
    { icon: Wallet,    label: "Portfolio",         path: "/funder/portfolio",   show: activeRole === "funder" },
    { icon: Receipt,   label: "Settlements",       path: "/funder/settlements", show: activeRole === "funder" },
    { icon: BarChart3, label: "Reports",           path: "/funder/reports",     show: activeRole === "funder" },

    // ── Common bottom ────────────────────────────────────────────
    { icon: HelpCircle, label: "Help Center", path: "/help",     show: true, section: "Common" },
    { icon: Settings,   label: "Settings",    path: "/settings", show: true },
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
        <Link to="/" className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6 hover:opacity-80 transition-opacity">
          <Hexagon className="h-5 w-5 text-sidebar-primary" strokeWidth={1.5} />
          <span className="text-lg font-semibold tracking-tight">Vybrel</span>
        </Link>

        {roles.length > 1 && (
          <div className="px-3 pt-4 pb-1">
            <Select value={activeRole} onValueChange={setActiveRole}>
              <SelectTrigger className="w-full h-9 bg-sidebar-accent/50 border-transparent hover:bg-sidebar-accent text-xs focus:ring-0">
                <SelectValue placeholder="Select role context" />
              </SelectTrigger>
              <SelectContent>
                {sortedRoles.map(r => (
                  <SelectItem key={r} value={r} className="text-xs focus:bg-sidebar-accent focus:text-sidebar-accent-foreground">
                    {roleLabels[r] || r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map((item, idx) => {
            const showSection = item.section && (idx === 0 || navItems[idx - 1]?.section !== item.section);
            return (
              <div key={item.path}>
                {showSection && idx > 0 && (
                  <div className="pt-4 pb-1 px-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">{item.section}</p>
                  </div>
                )}
                <Link
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    location.pathname === item.path || location.pathname.startsWith(item.path + "/")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </div>
            );
          })}
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
              <p className="truncate text-[10px] text-sidebar-foreground/50 font-medium uppercase tracking-wider">{activeRoleLabel}</p>
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

          <NotificationBell />

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
