import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ReportPage } from "@/components/reports/ReportPage";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportChart } from "@/components/reports/ReportChart";
import { Building2, DollarSign, TrendingUp, Users } from "lucide-react";

const platformData = [
  { month: "Jan", aum: 120, pipeline: 45, disbursed: 38 },
  { month: "Feb", aum: 135, pipeline: 52, disbursed: 44 },
  { month: "Mar", aum: 148, pipeline: 58, disbursed: 50 },
  { month: "Apr", aum: 162, pipeline: 63, disbursed: 55 },
  { month: "May", aum: 175, pipeline: 70, disbursed: 62 },
  { month: "Jun", aum: 190, pipeline: 78, disbursed: 68 },
];

const originatorPerformance = [
  { name: "Originator A", deals: 45, volume: 12.5 },
  { name: "Originator B", deals: 38, volume: 9.8 },
  { name: "Originator C", deals: 29, volume: 7.2 },
  { name: "Originator D", deals: 22, volume: 5.5 },
];

const revenueData = [
  { name: "Facility Fees", value: 35 },
  { name: "Service Fees", value: 28 },
  { name: "Late Fees", value: 12 },
  { name: "Other", value: 25 },
];

export default function AdminReports() {
  return (
    <DashboardLayout>
      <ReportPage
        title="Platform Analytics"
        description="Platform-wide performance metrics and originator analytics"
        onExportCSV={() => {}}
        onRefresh={() => {}}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReportCard title="Total AUM" value="$190M" change={8.2} icon={DollarSign} />
          <ReportCard title="Active Originators" value="12" change={2} icon={Building2} />
          <ReportCard title="Pipeline Volume" value="$78M" change={11.4} icon={TrendingUp} />
          <ReportCard title="Active Users" value="1,248" change={5.3} icon={Users} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReportChart
            title="Platform Growth (AUM in $M)"
            data={platformData}
            type="line"
            dataKeys={[
              { key: "aum", color: "hsl(217, 91%, 40%)", label: "AUM" },
              { key: "pipeline", color: "hsl(38, 92%, 50%)", label: "Pipeline" },
              { key: "disbursed", color: "hsl(142, 71%, 45%)", label: "Disbursed" },
            ]}
            xAxisKey="month"
          />
          <ReportChart
            title="Revenue Breakdown"
            data={revenueData}
            type="pie"
            dataKeys={[{ key: "value", color: "" }]}
          />
        </div>

        <ReportChart
          title="Originator Performance"
          data={originatorPerformance}
          type="bar"
          dataKeys={[
            { key: "deals", color: "hsl(217, 91%, 40%)", label: "Deals" },
            { key: "volume", color: "hsl(142, 71%, 45%)", label: "Volume ($M)" },
          ]}
        />
      </ReportPage>
    </DashboardLayout>
  );
}
