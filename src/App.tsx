import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SecurityHeaders } from "@/components/security/SecurityHeaders";
import { BrandingProvider } from "@/components/branding/BrandingProvider";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Install from "./pages/Install.tsx";
import AdminReports from "./pages/admin/Reports.tsx";
import OriginatorReports from "./pages/originator/Reports.tsx";
import OriginatorBranding from "./pages/originator/Branding.tsx";
import BorrowerReports from "./pages/borrower/Reports.tsx";
import FunderReports from "./pages/funder/Reports.tsx";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy.tsx";
import TermsOfService from "./pages/legal/TermsOfService.tsx";
import DataProcessingAgreement from "./pages/legal/DataProcessingAgreement.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrandingProvider>
        <SecurityHeaders />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/install" element={<Install />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/originator/reports" element={<OriginatorReports />} />
            <Route path="/originator/branding" element={<OriginatorBranding />} />
            <Route path="/borrower/reports" element={<BorrowerReports />} />
            <Route path="/funder/reports" element={<FunderReports />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/dpa" element={<DataProcessingAgreement />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </BrandingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
