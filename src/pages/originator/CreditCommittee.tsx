import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCommitteeDashboard } from "@/components/credit-committee/Dashboard";
import { CreditCommitteeApplications } from "@/components/credit-committee/Applications";
import { CreditCommitteeMinutes } from "@/components/credit-committee/Minutes";

export default function CreditCommittee() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Credit Committee</h1>
          <p className="text-muted-foreground">Manage credit decisions, applications and committee reviews</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
            <TabsTrigger value="minutes">Minutes</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <CreditCommitteeDashboard />
          </TabsContent>

          <TabsContent value="applications" className="mt-6">
            <CreditCommitteeApplications />
          </TabsContent>

          <TabsContent value="minutes" className="mt-6">
            <CreditCommitteeMinutes />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
