import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SecurityHeaders } from "@/components/security/SecurityHeaders";
import { BrandingProvider } from "@/components/branding/BrandingProvider";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Public pages
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";
import DataProcessingAgreement from "./pages/legal/DataProcessingAgreement";

// Protected pages
import Dashboard from "./pages/Dashboard";
import AdminReports from "./pages/admin/Reports";
import OriginatorReports from "./pages/originator/Reports";
import OriginatorBranding from "./pages/originator/Branding";
import AIInsightsPage from "./pages/originator/AIInsights";
import BorrowerReports from "./pages/borrower/Reports";
import BorrowerOnboarding from "./pages/borrower/Onboarding";
import FunderReports from "./pages/funder/Reports";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrandingProvider>
        <AuthProvider>
          <SecurityHeaders />
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Auth />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/install" element={<Install />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/dpa" element={<DataProcessingAgreement />} />

              {/* Protected routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin/reports" element={<ProtectedRoute requiredRoles={["admin"]}><AdminReports /></ProtectedRoute>} />

              {/* Originator */}
              <Route path="/originator/reports" element={<ProtectedRoute requiredRoles={["originator_admin", "originator_user"]}><OriginatorReports /></ProtectedRoute>} />
              <Route path="/originator/branding" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorBranding /></ProtectedRoute>} />
              <Route path="/originator/ai-insights" element={<ProtectedRoute requiredRoles={["originator_admin", "originator_user"]}><AIInsightsPage /></ProtectedRoute>} />

              {/* Borrower */}
              <Route path="/borrower/reports" element={<ProtectedRoute requiredRoles={["borrower"]}><BorrowerReports /></ProtectedRoute>} />
              <Route path="/borrower/onboarding" element={<ProtectedRoute requiredRoles={["borrower"]}><BorrowerOnboarding /></ProtectedRoute>} />

              {/* Funder */}
              <Route path="/funder/reports" element={<ProtectedRoute requiredRoles={["funder"]}><FunderReports /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </BrandingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
