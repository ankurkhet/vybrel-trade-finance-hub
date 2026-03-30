import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import HelpCentreContent from "@/components/help/HelpCentreContent";

export default function HelpCenter() {
  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.8))] -m-4 lg:-m-6">
        <HelpCentreContent />
      </div>
    </DashboardLayout>
  );
}
