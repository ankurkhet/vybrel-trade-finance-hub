import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  organization_id: string | null;
  is_active: boolean;
  roles: string[];
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  linked_borrower_id: string | null;
  linked_borrower_name: string | null;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
}

export interface BorrowerEntity {
  id: string;
  company_name: string;
  organization_id: string;
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [borrowerEntities, setBorrowerEntities] = useState<BorrowerEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const invoke = useCallback(async (body: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke("admin-manage-users", { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke({ action: "list_users" });
      setUsers(data.users || []);
      setOrganizations(data.organizations || []);
      setBorrowerEntities(data.borrower_entities || []);
    } catch (e: any) {
      toast({ title: "Error loading users", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [invoke, toast]);

  const createUser = useCallback(async (params: { email: string; full_name: string; password?: string; role: string; organization_id?: string }) => {
    const data = await invoke({ action: "create_user", ...params });
    toast({ title: "User created", description: `Account created for ${params.email}` });
    await fetchUsers();
    return data;
  }, [invoke, toast, fetchUsers]);

  const sendInvitation = useCallback(async (params: { email: string; full_name?: string; role: string; organization_id: string }) => {
    const data = await invoke({ action: "send_invitation", ...params });
    toast({ title: "Invitation sent", description: `Invitation sent to ${params.email}` });
    await fetchUsers();
    return data;
  }, [invoke, toast, fetchUsers]);

  const forcePasswordReset = useCallback(async (userId: string) => {
    const data = await invoke({ action: "force_password_reset", user_id: userId });
    toast({ title: "Password reset", description: data.message });
    return data;
  }, [invoke, toast]);

  const changeEmail = useCallback(async (userId: string, newEmail: string) => {
    const data = await invoke({ action: "change_email", user_id: userId, new_email: newEmail });
    toast({ title: "Email changed", description: data.message });
    await fetchUsers();
    return data;
  }, [invoke, toast, fetchUsers]);

  const updateRoles = useCallback(async (userId: string, roles: string[]) => {
    await invoke({ action: "update_roles", user_id: userId, roles });
    toast({ title: "Roles updated" });
    await fetchUsers();
  }, [invoke, toast, fetchUsers]);

  const updateOrganization = useCallback(async (userId: string, orgId: string | null) => {
    await invoke({ action: "update_organization", user_id: userId, organization_id: orgId });
    toast({ title: "Organization updated" });
    await fetchUsers();
  }, [invoke, toast, fetchUsers]);

  const toggleActive = useCallback(async (userId: string, isActive: boolean) => {
    await invoke({ action: "toggle_active", user_id: userId, is_active: isActive });
    toast({ title: isActive ? "User activated" : "User deactivated" });
    await fetchUsers();
  }, [invoke, toast, fetchUsers]);

  const linkBorrowerEntity = useCallback(async (userId: string, borrowerId: string | null) => {
    await invoke({ action: "link_borrower_entity", user_id: userId, borrower_id: borrowerId });
    toast({ title: "Borrower entity updated" });
    await fetchUsers();
  }, [invoke, toast, fetchUsers]);

  return {
    users, organizations, borrowerEntities, loading, fetchUsers,
    createUser, sendInvitation, forcePasswordReset,
    changeEmail, updateRoles, updateOrganization, toggleActive,
    linkBorrowerEntity,
  };
}
