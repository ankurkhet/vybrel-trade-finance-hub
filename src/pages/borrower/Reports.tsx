import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ReportPage } from "@/components/reports/ReportPage";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportChart } from "@/components/reports/ReportChart";
import { CreditCard, FileCheck, Receipt, Wallet } from "lucide-react";

const utilizationData = [
  { month: "Jan", limit: 5, used: 3.2 },
  { month: "Feb", limit: 5, used: 3.8 },
  { month: "Mar", limit: 7, used: 4.5 },
  { month: "Apr", limit: 7, used: 5.1 },
  { month: "May", limit: 7, used: 4.8 },
  { month: "Jun", limit: 10, used: 6.2 },
];

const transactionHistory = [
  { month: "Jan", invoices: 8, amount: 320 },
  { month: "Feb", invoices: 12, amount: 480 },
  { month: "Mar", invoices: 15, amount: 620 },
  { month: "Apr", invoices: 18, amount: 750 },
  { month: "May", invoices: 14, amount: 580 },
  { month: "Jun", invoices: 20, amount: 840 },
];

export default function BorrowerReports() {
  return (
    <DashboardLayout>
      <ReportPage
        title="My Reports"
        description="Facility utilization, transactions, and repayment overview"
        onExportCSV={() => {}}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReportCard title="Available Limit" value="$3.8M" icon={Wallet} />
          <ReportCard title="Outstanding Balance" value="$6.2M" icon={CreditCard} />
          <ReportCard title="Total Invoices" value="87" change={14} icon={Receipt} />
          <ReportCard title="Documents" value="24/26" subtitle="submitted" icon={FileCheck} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReportChart
            title="Facility Utilization ($M)"
            data={utilizationData}
            type="line"
            dataKeys={[
              { key: "limit", color: "hsl(217, 91%, 40%)", label: "Limit" },
              { key: "used", color: "hsl(38, 92%, 50%)", label: "Used" },
            ]}
            xAxisKey="month"
          />
          <ReportChart
            title="Transaction History ($K)"
            data={transactionHistory}
            type="bar"
            dataKeys={[
              { key: "amount", color: "hsl(217, 91%, 40%)", label: "Amount ($K)" },
            ]}
            xAxisKey="month"
          />
        </div>
      </ReportPage>
    </DashboardLayout>
  );
}
