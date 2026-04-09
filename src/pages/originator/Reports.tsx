import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ReportPage } from "@/components/reports/ReportPage";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportChart } from "@/components/reports/ReportChart";
import { Briefcase, Clock, DollarSign, PieChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subMonths, isAfter, parseISO } from "date-fns";

export default function OriginatorReports() {
  const { profile, user, isBroker } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [collectionsData, setCollectionsData] = useState<any[]>([]);
  const [funderAllocation, setFunderAllocation] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalExposure: 0,
    activeDeals: 0,
    avgTurnaround: 3.2,
    utilizationRate: 0
  });

  useEffect(() => {
    if (profile?.organization_id) {
      fetchData();
    }
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);

    // Brokers see only their directly-linked borrowers.
    // Pre-fetch linked borrower IDs once; null means no broker filter (originator sees all).
    let borrowerIdFilter: string[] | null = null;
    if (isBroker && user?.id) {
      const { data: linked } = await supabase
        .from("borrowers")
        .select("id")
        .eq("organization_id", profile!.organization_id)
        .eq("broker_user_id", user.id);
      borrowerIdFilter = (linked || []).map((b: any) => b.id);
    }

    // Sentinel value used when broker has no linked borrowers — forces zero results
    const noBorrowers = ["00000000-0000-0000-0000-000000000000"];

    // 1. Fetch Facility Requests for Pipeline Data (last 6 months)
    const sixMonthsAgo = subMonths(new Date(), 6);
    let frQuery = supabase
      .from("facility_requests")
      .select("status, created_at, amount_requested")
      .eq("organization_id", profile!.organization_id)
      .gte("created_at", sixMonthsAgo.toISOString());
    if (borrowerIdFilter !== null) {
      frQuery = frQuery.in("borrower_id", borrowerIdFilter.length > 0 ? borrowerIdFilter : noBorrowers);
    }
    const { data: facilities } = await frQuery;

    // Process pipeline data
    const monthMap = new Map();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      monthMap.set(format(d, "MMM"), { month: format(d, "MMM"), submitted: 0, approved: 0, declined: 0 });
    }

    let activeDeals = 0;
    if (facilities) {
      facilities.forEach(f => {
        const month = format(parseISO(f.created_at), "MMM");
        if (monthMap.has(month)) {
          const entry = monthMap.get(month);
          entry.submitted += 1;
          if (f.status === "approved") { entry.approved += 1; activeDeals++; }
          if (f.status === "rejected") entry.declined += 1;
        }
      });
    }
    setPipelineData(Array.from(monthMap.values()));

    // 2. Fetch Invoices for Collections Data
    let invQuery = supabase
      .from("invoices")
      .select("id, amount, due_date, status, accrued_late_fees")
      .eq("organization_id", profile!.organization_id)
      .in("status", ["funded", "partially_settled"]);
    if (borrowerIdFilter !== null) {
      invQuery = invQuery.in("borrower_id", borrowerIdFilter.length > 0 ? borrowerIdFilter : noBorrowers);
    }
    const { data: _invoices } = await invQuery;
    const invoices = _invoices as any[] | null;

    const aging = { "Current": 0, "1-30 days": 0, "31-60 days": 0, "61-90 days": 0, "90+ days": 0 };
    let totalExposure = 0;

    if (invoices) {
      const today = new Date();
      invoices.forEach(inv => {
        const amt = Number(inv.amount) + Number(inv.accrued_late_fees || 0);
        totalExposure += amt;

        const dueDate = parseISO(inv.due_date);
        if (isAfter(dueDate, today)) {
          aging["Current"] += amt;
        } else {
          const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 30) aging["1-30 days"] += amt;
          else if (diffDays <= 60) aging["31-60 days"] += amt;
          else if (diffDays <= 90) aging["61-90 days"] += amt;
          else aging["90+ days"] += amt;
        }
      });
    }
    setCollectionsData(Object.entries(aging).map(([name, value]) => ({ name, value })));

    // 3. Funder Allocation vs Utilization — not relevant for broker view
    if (!isBroker) {
      const { data: funders } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("organization_id", profile!.organization_id);

      const { data: limits } = await supabase
        .from("funder_limits")
        .select("funder_user_id, limit_amount")
        .eq("organization_id", profile!.organization_id);

      const { data: _disbs } = await supabase
        .from("disbursement_memos")
        .select("funder_user_id, disbursement_amount")
        .eq("organization_id", profile!.organization_id)
        .eq("status", "disbursed");
      const disbs = _disbs as any[] | null;

      const funderMap = new Map();
      if (funders) {
        funders.forEach(f => {
          funderMap.set(f.id, { funder: f.full_name, allocated: 0, utilized: 0 });
        });
      }

      let totalLimit = 0;
      if (limits) {
        limits.forEach(l => {
          totalLimit += Number(l.limit_amount);
          if (funderMap.has(l.funder_user_id)) {
            funderMap.get(l.funder_user_id).allocated += Number(l.limit_amount);
          }
        });
      }

      let totalUtilized = 0;
      if (disbs) {
        disbs.forEach(d => {
          if (d.funder_user_id) {
            totalUtilized += Number(d.disbursement_amount);
            if (funderMap.has(d.funder_user_id)) {
              funderMap.get(d.funder_user_id).utilized += Number(d.disbursement_amount);
            }
          }
        });
      }

      setFunderAllocation(Array.from(funderMap.values()).filter(f => f.allocated > 0 || f.utilized > 0));

      setSummary(prev => ({
        ...prev,
        totalExposure,
        activeDeals,
        avgTurnaround: 3.2,
        utilizationRate: totalLimit > 0 ? (totalUtilized / totalLimit) * 100 : 0,
      }));
    } else {
      setSummary(prev => ({
        ...prev,
        totalExposure,
        activeDeals,
        avgTurnaround: 3.2,
        utilizationRate: 0,
      }));
    }

    setLoading(false);
  };

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val}`;
  };

  return (
    <DashboardLayout>
      <ReportPage
        title="Originator Reports"
        description="Portfolio, pipeline, credit, and collections performance"
        onExportCSV={() => {}}
        onRefresh={fetchData}
      >
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${isBroker ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          <ReportCard title="Total Exposure" value={formatCurrency(summary.totalExposure)} icon={DollarSign} />
          <ReportCard title="Active Deals" value={summary.activeDeals.toString()} icon={Briefcase} />
          <ReportCard title="Avg. Turnaround" value={`${summary.avgTurnaround} days`} icon={Clock} />
          {!isBroker && (
            <ReportCard title="Utilization Rate" value={`${summary.utilizationRate.toFixed(1)}%`} icon={PieChart} />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ReportChart
            title="Deal Pipeline (Last 6 Months)"
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

        {!isBroker && (
          <ReportChart
            title="Funder Allocation vs Utilization"
            data={funderAllocation}
            type="bar"
            dataKeys={[
              { key: "allocated", color: "hsl(217, 91%, 40%)", label: "Allocated" },
              { key: "utilized", color: "hsl(142, 71%, 45%)", label: "Utilized" },
            ]}
            xAxisKey="funder"
          />
        )}
      </ReportPage>
    </DashboardLayout>
  );
}
