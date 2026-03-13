import { ReportPage } from "@/components/reports/ReportPage";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportChart } from "@/components/reports/ReportChart";
import { BarChart3, Percent, Shield, TrendingUp } from "lucide-react";

const portfolioData = [
  { month: "Jan", funded: 18, returns: 1.2 },
  { month: "Feb", funded: 22, returns: 1.5 },
  { month: "Mar", funded: 28, returns: 1.8 },
  { month: "Apr", funded: 32, returns: 2.1 },
  { month: "May", funded: 35, returns: 2.4 },
  { month: "Jun", funded: 40, returns: 2.8 },
];

const concentrationData = [
  { name: "Manufacturing", value: 30 },
  { name: "Services", value: 25 },
  { name: "Trade", value: 20 },
  { name: "Tech", value: 15 },
  { name: "Other", value: 10 },
];

const dealHistory = [
  { month: "Jan", offered: 12, accepted: 8, declined: 4 },
  { month: "Feb", offered: 15, accepted: 10, declined: 5 },
  { month: "Mar", offered: 18, accepted: 14, declined: 4 },
  { month: "Apr", offered: 20, accepted: 16, declined: 4 },
  { month: "May", offered: 22, accepted: 18, declined: 4 },
  { month: "Jun", offered: 25, accepted: 20, declined: 5 },
];

export default function FunderReports() {
  return (
    <ReportPage
      title="Portfolio Reports"
      description="Portfolio performance, concentration, and deal analytics"
      onExportCSV={() => {}}
      onRefresh={() => {}}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportCard title="Total Funded" value="$40M" change={14.3} icon={TrendingUp} />
        <ReportCard title="Avg. Yield" value="7.2%" change={0.5} icon={Percent} />
        <ReportCard title="Active Deals" value="86" change={11} icon={BarChart3} />
        <ReportCard title="Default Rate" value="0.8%" change={-0.2} icon={Shield} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportChart
          title="Portfolio Growth ($M)"
          data={portfolioData}
          type="line"
          dataKeys={[
            { key: "funded", color: "hsl(217, 91%, 40%)", label: "Funded" },
            { key: "returns", color: "hsl(142, 71%, 45%)", label: "Returns" },
          ]}
          xAxisKey="month"
        />
        <ReportChart
          title="Sector Concentration"
          data={concentrationData}
          type="pie"
          dataKeys={[{ key: "value", color: "" }]}
        />
      </div>

      <ReportChart
        title="Deal Acceptance History"
        data={dealHistory}
        type="bar"
        dataKeys={[
          { key: "offered", color: "hsl(199, 89%, 48%)", label: "Offered" },
          { key: "accepted", color: "hsl(142, 71%, 45%)", label: "Accepted" },
          { key: "declined", color: "hsl(0, 84%, 60%)", label: "Declined" },
        ]}
        xAxisKey="month"
      />
    </ReportPage>
  );
}
