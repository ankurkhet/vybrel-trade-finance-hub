import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, FileText, Brain, CreditCard, Upload, BarChart3, Shield } from "lucide-react";

export default function Dashboard() {
  const { profile, roles, isAdmin, isOriginatorAdmin, isBorrower, isFunder } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {profile?.full_name || "User"}
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening on your platform today.
          </p>
          <div className="mt-2 flex gap-2">
            {roles.map((role) => (
              <Badge key={role} variant="secondary" className="capitalize">
                {role.replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardCard icon={Building2} title="Organizations" value="—" subtitle="Active originators" />
            <DashboardCard icon={Users} title="Total Users" value="—" subtitle="Across all orgs" />
            <DashboardCard icon={FileText} title="Pending Reviews" value="—" subtitle="Documents awaiting review" />
            <DashboardCard icon={Brain} title="AI Analyses" value="—" subtitle="Completed today" />
          </div>
        )}

        {isOriginatorAdmin && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardCard icon={Users} title="Borrowers" value="—" subtitle="Active borrowers" />
            <DashboardCard icon={FileText} title="Contracts" value="—" subtitle="Active contracts" />
            <DashboardCard icon={CreditCard} title="Invoices" value="—" subtitle="Pending invoices" />
            <DashboardCard icon={Brain} title="Credit Memos" value="—" subtitle="Drafts pending review" />
          </div>
        )}

        {isBorrower && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DashboardCard icon={Upload} title="Documents" value="—" subtitle="Uploaded documents" />
            <DashboardCard icon={CreditCard} title="Invoices" value="—" subtitle="Submitted invoices" />
            <DashboardCard icon={BarChart3} title="Credit Limit" value="—" subtitle="Available limit" />
          </div>
        )}

        {isFunder && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DashboardCard icon={BarChart3} title="Portfolio" value="—" subtitle="Total exposure" />
            <DashboardCard icon={Shield} title="Risk Score" value="—" subtitle="Weighted average" />
            <DashboardCard icon={CreditCard} title="Returns" value="—" subtitle="YTD returns" />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function DashboardCard({ icon: Icon, title, value, subtitle }: {
  icon: any;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
