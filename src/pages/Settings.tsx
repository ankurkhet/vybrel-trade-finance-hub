import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SecuritySettings } from "@/components/security/SecuritySettings";

export default function Settings() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account and security preferences</p>
        </div>
        <SecuritySettings />
      </div>
    </DashboardLayout>
  );
}
