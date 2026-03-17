import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Users, UserPlus, Search, ChevronDown, ChevronRight, Building2, CircleDot } from "lucide-react";
import { useAdminUsers, type AdminUser } from "@/hooks/useAdminUsers";
import { UserManagementActions } from "@/components/admin/UserManagementActions";
import { CreateUserDialog } from "@/components/admin/CreateUserDialog";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  originator_admin: "bg-primary/10 text-primary border-primary/20",
  originator_user: "bg-info/10 text-info border-info/20",
  borrower: "bg-success/10 text-success border-success/20",
  funder: "bg-warning/10 text-warning border-warning/20",
  broker_admin: "bg-accent/10 text-accent border-accent/20",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  originator_admin: "Originator Admin",
  originator_user: "Originator User",
  borrower: "Borrower",
  funder: "Funder",
  broker_admin: "Broker Admin",
};

export default function AdminUsers() {
  const {
    users, organizations, loading, fetchUsers,
    createUser, sendInvitation, forcePasswordReset,
    changeEmail, updateRoles, updateOrganization, toggleActive,
  } = useAdminUsers();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Group users by organization
  const grouped = useMemo(() => {
    const filtered = users.filter(u =>
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.roles.some(r => ROLE_LABELS[r]?.toLowerCase().includes(search.toLowerCase()))
    );

    const groups: Record<string, { orgName: string; users: AdminUser[] }> = {};

    // Unassigned group
    const unassigned = filtered.filter(u => !u.organization_id);
    if (unassigned.length > 0) {
      groups["__unassigned__"] = { orgName: "Unassigned / Platform", users: unassigned };
    }

    // Group by org
    for (const org of organizations) {
      const orgUsers = filtered.filter(u => u.organization_id === org.id);
      if (orgUsers.length > 0) {
        groups[org.id] = { orgName: org.name, users: orgUsers };
      }
    }

    return groups;
  }, [users, organizations, search]);

  const toggleOrg = (orgId: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId); else next.add(orgId);
      return next;
    });
  };

  // Expand all by default when data loads
  useEffect(() => {
    if (Object.keys(grouped).length > 0 && expandedOrgs.size === 0) {
      setExpandedOrgs(new Set(Object.keys(grouped)));
    }
  }, [grouped]);

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Management</h1>
            <p className="text-sm text-muted-foreground">
              {totalUsers} users total · {activeUsers} active
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Add User
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or role..."
            className="pl-9"
          />
        </div>

        {/* Grouped users */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-3 text-muted-foreground">
                {search ? "No users match your search." : "No users found."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([orgId, group]) => {
              const isOpen = expandedOrgs.has(orgId);
              return (
                <Card key={orgId}>
                  <Collapsible open={isOpen} onOpenChange={() => toggleOrg(orgId)}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-4">
                        <CardTitle className="flex items-center gap-3 text-base font-medium">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <Building2 className="h-4 w-4 text-primary" />
                          {group.orgName}
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {group.users.length} {group.users.length === 1 ? "user" : "users"}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-2">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Roles</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Sign In</TableHead>
                                <TableHead className="w-[60px]" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.users.map(user => (
                                <TableRow key={user.id} className={!user.is_active ? "opacity-50" : ""}>
                                  <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                                  <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {user.roles.map(role => (
                                        <Badge
                                          key={role}
                                          variant="outline"
                                          className={`text-xs ${ROLE_COLORS[role] || ""}`}
                                        >
                                          {ROLE_LABELS[role] || role}
                                        </Badge>
                                      ))}
                                      {user.roles.length === 0 && (
                                        <span className="text-xs text-muted-foreground">No roles</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1.5">
                                      <CircleDot className={`h-3 w-3 ${user.is_active ? "text-success" : "text-destructive"}`} />
                                      <span className="text-xs">{user.is_active ? "Active" : "Inactive"}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {user.last_sign_in_at
                                      ? new Date(user.last_sign_in_at).toLocaleDateString()
                                      : "Never"
                                    }
                                  </TableCell>
                                  <TableCell>
                                    <UserManagementActions
                                      user={user}
                                      organizations={organizations}
                                      onForcePasswordReset={forcePasswordReset}
                                      onChangeEmail={changeEmail}
                                      onUpdateRoles={updateRoles}
                                      onUpdateOrganization={updateOrganization}
                                      onToggleActive={toggleActive}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        organizations={organizations}
        onCreateUser={createUser}
        onSendInvitation={sendInvitation}
      />
    </DashboardLayout>
  );
}
