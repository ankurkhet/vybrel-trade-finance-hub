import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, FileText, Brain, CreditCard, Upload, BarChart3, Shield, Briefcase, Receipt } from "lucide-react";

interface DashboardStat {
  value: string;
  loading: boolean;
}

export default function Dashboard() {
  const { profile, roles, isAdmin, isOriginatorAdmin, isBorrower, isFunder, isBroker } = useAuth();
  const navigate = useNavigate();

  // Admin stats
  const [orgCount, setOrgCount] = useState<DashboardStat>({ value: "—", loading: true });
  const [userCount, setUserCount] = useState<DashboardStat>({ value: "—", loading: true });
  const [pendingDocs, setPendingDocs] = useState<DashboardStat>({ value: "—", loading: true });
  const [aiCount, setAiCount] = useState<DashboardStat>({ value: "—", loading: true });

  // Originator / Broker stats
  const [borrowerCount, setBorrowerCount] = useState<DashboardStat>({ value: "—", loading: true });
  const [contractCount, setContractCount] = useState<DashboardStat>({ value: "—", loading: true });
  const [invoiceCount, setInvoiceCount] = useState<DashboardStat>({ value: "—", loading: true });
  const [memoCount, setMemoCount] = useState<DashboardStat>({ value: "—", loading: true });

  // Borrower stats
  const [myDocCount, setMyDocCount] = useState<DashboardStat>({ value: "—", loading: true });
  const [myInvoiceCount, setMyInvoiceCount] = useState<DashboardStat>({ value: "—", loading: true });
  const [creditLimit, setCreditLimit] = useState<DashboardStat>({ value: "—", loading: true });

  // Funder stats
  const [portfolioValue, setPortfolioValue] = useState<DashboardStat>({ value: "—", loading: true });
  const [activeDeals, setActiveDeals] = useState<DashboardStat>({ value: "—", loading: true });

  useEffect(() => {
    if (isAdmin) {
      supabase.from("organizations").select("id", { count: "exact", head: true }).then(({ count }) => {
        setOrgCount({ value: String(count ?? 0), loading: false });
      });
      supabase.from("profiles").select("id", { count: "exact", head: true }).then(({ count }) => {
        setUserCount({ value: String(count ?? 0), loading: false });
      });
      supabase.from("org_documents").select("id", { count: "exact", head: true }).eq("status", "pending").then(({ count }) => {
        setPendingDocs({ value: String(count ?? 0), loading: false });
      });
      supabase.from("ai_analyses").select("id", { count: "exact", head: true }).eq("status", "completed").then(({ count }) => {
        setAiCount({ value: String(count ?? 0), loading: false });
      });
    }

    if (isOriginatorAdmin || isBroker) {
      supabase.from("borrowers").select("id", { count: "exact", head: true }).then(({ count }) => {
        setBorrowerCount({ value: String(count ?? 0), loading: false });
      });
      supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "active").then(({ count }) => {
        setContractCount({ value: String(count ?? 0), loading: false });
      });
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("status", "pending").then(({ count }) => {
        setInvoiceCount({ value: String(count ?? 0), loading: false });
      });
      supabase.from("credit_memos").select("id", { count: "exact", head: true }).eq("status", "draft").then(({ count }) => {
        setMemoCount({ value: String(count ?? 0), loading: false });
      });
    }

    if (isBorrower) {
      supabase.from("documents").select("id", { count: "exact", head: true }).then(({ count }) => {
        setMyDocCount({ value: String(count ?? 0), loading: false });
      });
      supabase.from("invoices").select("id", { count: "exact", head: true }).then(({ count }) => {
        setMyInvoiceCount({ value: String(count ?? 0), loading: false });
      });
      supabase.from("borrowers").select("credit_limit").limit(1).then(({ data }) => {
        const limit = data?.[0]?.credit_limit;
        setCreditLimit({ value: limit ? `$${(Number(limit) / 1000000).toFixed(1)}M` : "$0", loading: false });
      });
    }

    if (isFunder) {
      supabase.from("funding_offers").select("offer_amount").eq("status", "accepted").then(({ data }) => {
        const total = data?.reduce((sum, o) => sum + Number(o.offer_amount), 0) ?? 0;
        setPortfolioValue({ value: total > 0 ? `$${(total / 1000000).toFixed(1)}M` : "$0", loading: false });
      });
      supabase.from("funding_offers").select("id", { count: "exact", head: true }).eq("status", "accepted").then(({ count }) => {
        setActiveDeals({ value: String(count ?? 0), loading: false });
      });
    }
  }, [isAdmin, isOriginatorAdmin, isBorrower, isFunder, isBroker]);

  const basePath = isBroker ? "/broker" : "/originator";

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
            <DashboardCard icon={Building2} title="Organizations" value={orgCount.value} subtitle="Active originators" onClick={() => navigate("/admin/organizations")} />
            <DashboardCard icon={Users} title="Total Users" value={userCount.value} subtitle="Across all orgs" onClick={() => navigate("/admin/users")} />
            <DashboardCard icon={FileText} title="Pending Reviews" value={pendingDocs.value} subtitle="Documents awaiting review" onClick={() => navigate("/admin/organizations")} />
            <DashboardCard icon={Brain} title="AI Analyses" value={aiCount.value} subtitle="Completed" />
          </div>
        )}

        {(isOriginatorAdmin || isBroker) && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DashboardCard icon={Users} title="Borrowers" value={borrowerCount.value} subtitle="Active borrowers" onClick={() => navigate(`${basePath}/borrowers`)} />
            <DashboardCard icon={FileText} title="Contracts" value={contractCount.value} subtitle="Active contracts" onClick={() => navigate(`${basePath}/contracts`)} />
            <DashboardCard icon={CreditCard} title="Invoices" value={invoiceCount.value} subtitle="Pending invoices" onClick={() => navigate(`${basePath}/invoices`)} />
            <DashboardCard icon={Brain} title="Credit Memos" value={memoCount.value} subtitle="Drafts pending review" />
          </div>
        )}

        {isBorrower && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DashboardCard icon={Upload} title="Documents" value={myDocCount.value} subtitle="Uploaded documents" onClick={() => navigate("/borrower/documents")} />
            <DashboardCard icon={CreditCard} title="Invoices" value={myInvoiceCount.value} subtitle="Submitted invoices" onClick={() => navigate("/borrower/invoices")} />
            <DashboardCard icon={BarChart3} title="Credit Limit" value={creditLimit.value} subtitle="Available limit" />
          </div>
        )}

        {isFunder && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DashboardCard icon={BarChart3} title="Portfolio" value={portfolioValue.value} subtitle="Total exposure" onClick={() => navigate("/funder/portfolio")} />
            <DashboardCard icon={Shield} title="Active Deals" value={activeDeals.value} subtitle="Funded deals" onClick={() => navigate("/funder/portfolio")} />
            <DashboardCard icon={CreditCard} title="Marketplace" value="Browse" subtitle="View available invoices" onClick={() => navigate("/funder/marketplace")} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function DashboardCard({ icon: Icon, title, value, subtitle, onClick }: {
  icon: any;
  title: string;
  value: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <Card 
      className={onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""}
      onClick={onClick}
    >
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
