import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ReportPage } from "@/components/reports/ReportPage";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportChart } from "@/components/reports/ReportChart";
import { BarChart3, Percent, Shield, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subMonths, parseISO } from "date-fns";

export default function FunderReports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [portfolioData, setPortfolioData] = useState<any[]>([]);
  const [concentrationData, setConcentrationData] = useState<any[]>([]);
  const [dealHistory, setDealHistory] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalFunded: 0,
    avgYield: 0,
    activeDeals: 0,
    defaultRate: 0.8
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);

    // 1. Fetch Disbursement Memos for Portfolio Growth and Total Funded
    const { data: _disbursements } = await (supabase as any)
      .from("disbursement_memos")
      .select(`
        id, created_at, disbursement_amount, funder_fee,
        invoice:invoices (
          borrower_id,
          borrower:borrowers (industry)
        )
      `)
      .eq("funder_user_id", user!.id)
      .eq("status", "disbursed");
    const disbursements = _disbursements as any[] | null;

    let totalFunded = 0;
    let totalYield = 0;
    let activeDeals = 0;

    const monthMap = new Map();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      monthMap.set(format(d, "MMM"), { month: format(d, "MMM"), funded: 0, returns: 0 });
    }

    const industryMap = new Map();

    if (disbursements) {
      activeDeals = disbursements.length;
      disbursements.forEach(d => {
        const amt = Number(d.disbursement_amount) || 0;
        const fee = Number(d.funder_fee) || 0;
        
        totalFunded += amt;
        totalYield += fee;

        const month = format(parseISO(d.created_at), "MMM");
        if (monthMap.has(month)) {
          const entry = monthMap.get(month);
          entry.funded += amt / 1000000; // $M
          entry.returns += fee / 1000000; // $M
        }

        // Sector concentration
        const inv = Array.isArray(d.invoice) ? d.invoice[0] : d.invoice;
        const borrower = Array.isArray(inv?.borrower) ? inv?.borrower[0] : inv?.borrower;
        const industry = borrower?.industry || "Other";
        
        if (!industryMap.has(industry)) {
          industryMap.set(industry, 0);
        }
        industryMap.set(industry, industryMap.get(industry) + amt);
      });
    }
    
    // Accumulate total funded historically for the chart
    let runningFunded = 0;
    let runningReturns = 0;
    const portfolioChart = Array.from(monthMap.values()).map(entry => {
      runningFunded += entry.funded;
      runningReturns += entry.returns;
      return {
        month: entry.month,
        funded: Number(runningFunded.toFixed(2)),
        returns: Number(runningReturns.toFixed(2))
      };
    });
    setPortfolioData(portfolioChart);

    // Prepare concentration
    const conc = Array.from(industryMap.entries()).map(([name, value]) => ({
      name,
      value
    })).sort((a,b) => b.value - a.value).slice(0, 5); // top 5
    // Normalize to percentage
    const concTotal = conc.reduce((s, c) => s + c.value, 0);
    const concPerc = conc.map(c => ({ name: c.name, value: concTotal > 0 ? (c.value / concTotal) * 100 : 0 }));
    setConcentrationData(concPerc.length > 0 ? concPerc : [{ name: "No Data", value: 100 }]);

    // 2. Fetch limit referrals vs disbursements for Deal History
    const { data: limits } = await supabase
      .from("funder_limits")
      .select("created_at")
      .eq("funder_user_id", user!.id);
      
    const dealMap = new Map();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      dealMap.set(format(d, "MMM"), { month: format(d, "MMM"), offered: 0, accepted: 0, declined: 0 });
    }

    if (limits) {
      limits.forEach(l => {
        const month = format(parseISO(l.created_at), "MMM");
        if (dealMap.has(month)) {
          dealMap.get(month).offered += 1;
        }
      });
    }
    
    if (disbursements) {
      disbursements.forEach(d => {
        const month = format(parseISO(d.created_at), "MMM");
        if (dealMap.has(month)) {
          dealMap.get(month).accepted += 1;
        }
      });
    }
    setDealHistory(Array.from(dealMap.values()));

    setSummary({
      totalFunded,
      avgYield: totalFunded > 0 ? (totalYield / totalFunded) * 100 : 0,
      activeDeals,
      defaultRate: 0.0 // Assuming no logic for default rate yet
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
        title="Portfolio Reports"
        description="Portfolio performance, concentration, and deal analytics"
        onExportCSV={() => {}}
        onRefresh={fetchData}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReportCard title="Total Funded" value={formatCurrency(summary.totalFunded)} icon={TrendingUp} />
          <ReportCard title="Avg. Yield" value={`${summary.avgYield.toFixed(2)}%`} icon={Percent} />
          <ReportCard title="Active Deals" value={summary.activeDeals.toString()} icon={BarChart3} />
          <ReportCard title="Default Rate" value={`${summary.defaultRate}%`} icon={Shield} />
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
            title="Sector Concentration (%)"
            data={concentrationData}
            type="pie"
            dataKeys={[{ key: "value", color: "" }]}
          />
        </div>

        <ReportChart
          title="Deal History (Limit Referrals vs Funded)"
          data={dealHistory}
          type="bar"
          dataKeys={[
            { key: "offered", color: "hsl(199, 89%, 48%)", label: "Referred" },
            { key: "accepted", color: "hsl(142, 71%, 45%)", label: "Funded" },
            { key: "declined", color: "hsl(0, 84%, 60%)", label: "Declined" },
          ]}
          xAxisKey="month"
        />
      </ReportPage>
    </DashboardLayout>
  );
}
