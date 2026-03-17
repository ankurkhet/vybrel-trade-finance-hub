import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CreditCommitteeSettings } from "@/components/credit-committee/Settings";

export default function CreditCommitteeConfig() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Committee Configuration</h1>
          <p className="text-muted-foreground">Manage committee members and quorum rules</p>
        </div>
        <CreditCommitteeSettings />
      </div>
    </DashboardLayout>
  );
}
