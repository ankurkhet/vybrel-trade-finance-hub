import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MoreHorizontal, KeyRound, Mail, Shield, Building2, UserX, UserCheck } from "lucide-react";
import type { AdminUser, Org } from "@/hooks/useAdminUsers";

const ALL_ROLES = [
  { value: "admin", label: "Admin" },
  { value: "originator_admin", label: "Originator Admin" },
  { value: "originator_user", label: "Originator User" },
  { value: "borrower", label: "Borrower" },
  { value: "funder", label: "Funder" },
  { value: "broker_admin", label: "Broker Admin" },
];

interface Props {
  user: AdminUser;
  organizations: Org[];
  onForcePasswordReset: (userId: string) => Promise<void>;
  onChangeEmail: (userId: string, newEmail: string) => Promise<void>;
  onUpdateRoles: (userId: string, roles: string[]) => Promise<void>;
  onUpdateOrganization: (userId: string, orgId: string | null) => Promise<void>;
  onToggleActive: (userId: string, isActive: boolean) => Promise<void>;
}

export function UserManagementActions({
  user, organizations, onForcePasswordReset, onChangeEmail,
  onUpdateRoles, onUpdateOrganization, onToggleActive,
}: Props) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles);
  const [selectedOrg, setSelectedOrg] = useState(user.organization_id || "none");
  const [processing, setProcessing] = useState(false);

  const handleAction = async (fn: () => Promise<void>) => {
    setProcessing(true);
    try { await fn(); } finally { setProcessing(false); }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleAction(() => onForcePasswordReset(user.id))}>
            <KeyRound className="mr-2 h-4 w-4" /> Force Password Reset
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setNewEmail(user.email); setEmailDialogOpen(true); }}>
            <Mail className="mr-2 h-4 w-4" /> Change Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setSelectedRoles(user.roles); setRolesDialogOpen(true); }}>
            <Shield className="mr-2 h-4 w-4" /> Manage Roles
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setSelectedOrg(user.organization_id || "none"); setOrgDialogOpen(true); }}>
            <Building2 className="mr-2 h-4 w-4" /> Change Organization
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleAction(() => onToggleActive(user.id, !user.is_active))}
            className={user.is_active ? "text-destructive" : "text-success"}
          >
            {user.is_active ? <UserX className="mr-2 h-4 w-4" /> : <UserCheck className="mr-2 h-4 w-4" />}
            {user.is_active ? "Deactivate User" : "Activate User"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Change Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email Address</DialogTitle>
            <DialogDescription>
              This will notify the user on both their old and new email addresses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Current Email</Label>
              <Input value={user.email} disabled className="mt-1" />
            </div>
            <div>
              <Label>New Email</Label>
              <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@example.com" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={processing || !newEmail || newEmail === user.email}
              onClick={() => handleAction(async () => {
                await onChangeEmail(user.id, newEmail);
                setEmailDialogOpen(false);
              })}
            >
              {processing ? "Updating..." : "Change Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Roles Dialog */}
      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Roles for {user.full_name || user.email}</DialogTitle>
            <DialogDescription>Select one or more roles for this user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {ALL_ROLES.map(role => (
              <div key={role.value} className="flex items-center gap-3">
                <Checkbox
                  id={`role-${role.value}`}
                  checked={selectedRoles.includes(role.value)}
                  onCheckedChange={(checked) => {
                    setSelectedRoles(prev =>
                      checked ? [...prev, role.value] : prev.filter(r => r !== role.value)
                    );
                  }}
                />
                <Label htmlFor={`role-${role.value}`} className="cursor-pointer">{role.label}</Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={processing || selectedRoles.length === 0}
              onClick={() => handleAction(async () => {
                await onUpdateRoles(user.id, selectedRoles);
                setRolesDialogOpen(false);
              })}
            >
              {processing ? "Saving..." : "Save Roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Organization Dialog */}
      <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Organization</DialogTitle>
            <DialogDescription>Assign this user to a different organization.</DialogDescription>
          </DialogHeader>
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger>
              <SelectValue placeholder="Select organization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Organization</SelectItem>
              {organizations.map(org => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrgDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={processing}
              onClick={() => handleAction(async () => {
                await onUpdateOrganization(user.id, selectedOrg === "none" ? null : selectedOrg);
                setOrgDialogOpen(false);
              })}
            >
              {processing ? "Saving..." : "Update Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
