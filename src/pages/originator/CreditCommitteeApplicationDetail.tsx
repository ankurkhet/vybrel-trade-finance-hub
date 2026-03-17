import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ApplicationDetail } from "@/components/credit-committee/ApplicationDetail";

export default function CreditCommitteeApplicationDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <DashboardLayout>
      <ApplicationDetail applicationId={id!} />
    </DashboardLayout>
  );
}
