import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Org } from "@/hooks/useAdminUsers";

const ALL_ROLES = [
  { value: "admin", label: "Vybrel Admin" },
  { value: "originator_admin", label: "Originator Admin" },
  { value: "originator_user", label: "Originator User" },
  { value: "borrower", label: "Borrower" },
  { value: "funder", label: "Funder" },
  { value: "broker_admin", label: "Broker Admin" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: Org[];
  onCreateUser: (params: { email: string; full_name: string; password?: string; role: string; organization_id?: string }) => Promise<any>;
  onSendInvitation: (params: { email: string; full_name?: string; role: string; organization_id: string }) => Promise<any>;
}

export function CreateUserDialog({ open, onOpenChange, organizations, onCreateUser, onSendInvitation }: Props) {
  const [tab, setTab] = useState("create");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [orgId, setOrgId] = useState("");
  const [processing, setProcessing] = useState(false);

  // For admin role, org is not required
  const isAdminRole = role === "admin";

  const reset = () => {
    setEmail(""); setFullName(""); setPassword(""); setRole(""); setOrgId("");
  };

  const handleCreate = async () => {
    setProcessing(true);
    try {
      await onCreateUser({
        email, full_name: fullName, role,
        ...(password ? { password } : {}),
        ...(orgId && !isAdminRole ? { organization_id: orgId } : {}),
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      // handled by hook
    } finally {
      setProcessing(false);
    }
  };

  const handleInvite = async () => {
    // For admin role, use a placeholder org or skip org requirement
    if (!isAdminRole && !orgId) return;
    setProcessing(true);
    try {
      if (isAdminRole) {
        // Create directly since admin doesn't need an org
        await onCreateUser({
          email, full_name: fullName || email, role,
        });
      } else {
        await onSendInvitation({ email, full_name: fullName || undefined, role, organization_id: orgId });
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      // handled by hook
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>Create an account directly or send an invitation.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Direct Creation</TabsTrigger>
            <TabsTrigger value="invite">Send Invitation</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-3 mt-4">
            <div>
              <Label>Full Name *</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Smith" className="mt-1" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" type="email" className="mt-1" />
            </div>
            <div>
              <Label>Password (optional — user will get a setup email if blank)</Label>
              <Input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Leave blank for email setup" className="mt-1" />
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!isAdminRole && (
              <div>
                <Label>Organization</Label>
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select organization (optional)" /></SelectTrigger>
                  <SelectContent>
                    {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={processing || !email || !fullName || !role} onClick={handleCreate}>
                {processing ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="invite" className="space-y-3 mt-4">
            <div>
              <Label>Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="John Smith" className="mt-1" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" type="email" className="mt-1" />
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!isAdminRole && (
              <div>
                <Label>Organization *</Label>
                <Select value={orgId} onValueChange={setOrgId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select organization" /></SelectTrigger>
                  <SelectContent>
                    {organizations.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={processing || !email || !role || (!isAdminRole && !orgId)} onClick={handleInvite}>
                {processing ? "Sending..." : isAdminRole ? "Create Admin" : "Send Invitation"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
