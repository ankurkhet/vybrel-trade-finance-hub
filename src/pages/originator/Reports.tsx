import { ReportPage } from "@/components/reports/ReportPage";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportChart } from "@/components/reports/ReportChart";
import { Briefcase, Clock, DollarSign, PieChart } from "lucide-react";

const pipelineData = [
  { month: "Jan", submitted: 18, approved: 12, declined: 3 },
  { month: "Feb", submitted: 22, approved: 15, declined: 4 },
  { month: "Mar", submitted: 25, approved: 18, declined: 2 },
  { month: "Apr", submitted: 28, approved: 20, declined: 5 },
  { month: "May", submitted: 32, approved: 24, declined: 3 },
  { month: "Jun", submitted: 35, approved: 28, declined: 4 },
];

const collectionsData = [
  { name: "Current", value: 65 },
  { name: "1-30 days", value: 18 },
  { name: "31-60 days", value: 10 },
  { name: "61-90 days", value: 5 },
  { name: "90+ days", value: 2 },
];

const funderAllocation = [
  { funder: "Funder Alpha", allocated: 45, utilized: 38 },
  { funder: "Funder Beta", allocated: 35, utilized: 28 },
  { funder: "Funder Gamma", allocated: 25, utilized: 20 },
  { funder: "Funder Delta", allocated: 15, utilized: 12 },
];

export default function OriginatorReports() {
  return (
    <ReportPage
      title="Originator Reports"
      description="Portfolio, pipeline, credit, and collections performance"
      onExportCSV={() => {}}
      onRefresh={() => {}}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportCard title="Total Exposure" value="$42.5M" change={6.3} icon={DollarSign} />
        <ReportCard title="Active Deals" value="156" change={12} icon={Briefcase} />
        <ReportCard title="Avg. Turnaround" value="3.2 days" change={-15} icon={Clock} />
        <ReportCard title="Utilization Rate" value="78%" change={4.1} icon={PieChart} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportChart
          title="Deal Pipeline"
          data={pipelineData}
          type="bar"
          dataKeys={[
            { key: "submitted", color: "hsl(217, 91%, 40%)", label: "Submitted" },
            { key: "approved", color: "hsl(142, 71%, 45%)", label: "Approved" },
            { key: "declined", color: "hsl(0, 84%, 60%)", label: "Declined" },
          ]}
          xAxisKey="month"
        />
        <ReportChart
          title="Collections Aging"
          data={collectionsData}
          type="pie"
          dataKeys={[{ key: "value", color: "" }]}
        />
      </div>

      <ReportChart
        title="Funder Allocation vs Utilization ($M)"
        data={funderAllocation}
        type="bar"
        dataKeys={[
          { key: "allocated", color: "hsl(217, 91%, 40%)", label: "Allocated" },
          { key: "utilized", color: "hsl(142, 71%, 45%)", label: "Utilized" },
        ]}
        xAxisKey="funder"
      />
    </ReportPage>
  );
}
