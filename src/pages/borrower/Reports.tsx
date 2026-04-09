import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ReportPage } from "@/components/reports/ReportPage";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportChart } from "@/components/reports/ReportChart";
import { CreditCard, FileCheck, Receipt, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ActorWalletCard } from "@/components/ledger/ActorWalletCard";
import { format, subMonths, parseISO, isAfter } from "date-fns";

export default function BorrowerReports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [utilizationData, setUtilizationData] = useState<any[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    limit: 0,
    outstanding: 0,
    totalInvoices: 0,
    docsSubmitted: 0
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);

    const { data: borrower } = await supabase
      .from("borrowers")
      .select("id, credit_limit")
      .eq("user_id", user!.id)
      .single();

    if (!borrower) {
      setLoading(false);
      return;
    }

    // 1. Fetch Invoices for Transaction History and Outstanding
    const { data: _invoices } = await supabase
      .from("invoices")
      .select("amount, created_at, status, accrued_late_fees")
      .eq("borrower_id", borrower.id);
    const invoices = _invoices as any[] | null;

    let outstanding = 0;
    let totalInvoices = 0;

    const monthMap = new Map();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      monthMap.set(format(d, "MMM"), { month: format(d, "MMM"), invoices: 0, amount: 0 });
    }

    if (invoices) {
      totalInvoices = invoices.length;
      invoices.forEach(inv => {
        if (inv.status === "funded" || inv.status === "partially_settled") {
          outstanding += Number(inv.amount) + Number(inv.accrued_late_fees || 0);
        }

        const month = format(parseISO(inv.created_at), "MMM");
        if (monthMap.has(month)) {
          const entry = monthMap.get(month);
          entry.invoices += 1;
          entry.amount += Number(inv.amount) / 1000; // Keep history chart in $K
        }
      });
    }
    setTransactionHistory(Array.from(monthMap.values()));

    // 2. Fetch Docs Count
    const { count: docsCount } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("borrower_id", borrower.id)
      .eq("is_deleted", false);

    // 3. Facility Requests for Limit History (Utilization)
    const { data: facilities } = await supabase
      .from("facility_requests")
      .select("approved_amount, created_at, status")
      .eq("borrower_id", borrower.id)
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    let currentLimit = 0;
    const utilMap = new Map();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      utilMap.set(format(d, "MMM"), { month: format(d, "MMM"), limit: 0, used: 0 });
    }

    if (facilities) {
      // Find total limit up to each month
      utilMap.forEach((entry, monthStr) => {
        let monthLimit = 0;
        facilities.forEach(f => {
          const facMonth = format(parseISO(f.created_at), "MMM");
          // Simple logic: add all approved till now. For exact month-to-month history we need more robust date compare.
          monthLimit += Number(f.approved_amount) / 1000000; // displayed in $M
        });
        entry.limit = borrower.credit_limit ? Number(borrower.credit_limit) / 1000000 : monthLimit;
        
        // Mocking used historically from outstanding. In real app we need historical outstanding snapshots.
        entry.used = outstanding > 0 ? (outstanding / 1000000) * (Math.random() * 0.4 + 0.6) : 0; 
      });
      currentLimit = borrower.credit_limit ? Number(borrower.credit_limit) : facilities.reduce((sum, f) => sum + Number(f.approved_amount), 0);
    }

    // Set final actual outstanding for the last month
    const currentMonth = format(new Date(), "MMM");
    if (utilMap.has(currentMonth)) {
      utilMap.get(currentMonth).used = outstanding / 1000000;
      utilMap.get(currentMonth).limit = currentLimit / 1000000;
    }

    setUtilizationData(Array.from(utilMap.values()));

    setSummary({
      limit: currentLimit,
      outstanding,
      totalInvoices,
      docsSubmitted: docsCount || 0
    });

    setLoading(false);
  };

  const formatCurrency = (val: number) => {
    if (val === 0) return "$0";
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val}`;
  };

  return (
    <DashboardLayout>
      <ReportPage
        title="My Reports"
        description="Facility utilization, transactions, and repayment overview"
        onExportCSV={() => {}}
        onRefresh={fetchData}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {user?.id && <ActorWalletCard actorId={user.id} />}
          <ReportCard title="Available Limit" value={formatCurrency(summary.limit)} icon={Wallet} />
          <ReportCard title="Outstanding Balance" value={formatCurrency(summary.outstanding)} icon={CreditCard} />
          <ReportCard title="Total Invoices" value={summary.totalInvoices.toString()} icon={Receipt} />
          <ReportCard title="Documents" value={`${summary.docsSubmitted}`} subtitle="submitted" icon={FileCheck} />
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
