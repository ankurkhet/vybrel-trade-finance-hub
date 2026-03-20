import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CreditMemoEditor } from "@/components/credit-memo/CreditMemoEditor";
import { Loader2 } from "lucide-react";

export default function CreditMemoDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: memo, isLoading } = useQuery({
    queryKey: ["credit-memo", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_memos")
        .select("*, borrowers(company_name)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!memo) {
    return (
      <DashboardLayout>
        <p className="text-destructive">Credit memo not found.</p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <CreditMemoEditor
        borrowerId={memo.borrower_id}
        organizationId={memo.organization_id}
        borrowerName={(memo as any).borrowers?.company_name || "Unknown Borrower"}
      />
    </DashboardLayout>
  );
}
