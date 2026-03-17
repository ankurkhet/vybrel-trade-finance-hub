import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SecuritySettings } from "@/components/security/SecuritySettings";
import { EmailDomainSettings } from "@/components/admin/EmailDomainSettings";
import { useAuth } from "@/hooks/useAuth";

export default function Settings() {
  const { isAdmin } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and security preferences</p>
        </div>
        <SecuritySettings />
        {isAdmin && <EmailDomainSettings />}
      </div>
    </DashboardLayout>
  );
}
