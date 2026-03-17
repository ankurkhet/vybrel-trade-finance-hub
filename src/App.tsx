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
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";
import AcceptInvoice from "./pages/counterparty/AcceptInvoice";
import CounterpartyDashboard from "./pages/counterparty/Dashboard";
import Install from "./pages/Install";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfService from "./pages/legal/TermsOfService";
import DataProcessingAgreement from "./pages/legal/DataProcessingAgreement";

// Protected pages
import Dashboard from "./pages/Dashboard";
import AdminReports from "./pages/admin/Reports";
import AdminOrganizations from "./pages/admin/Organizations";
import AdminUsers from "./pages/admin/Users";
import AdminProducts from "./pages/admin/Products";
import AdminAuditLogs from "./pages/admin/AuditLogs";
import OriginatorReports from "./pages/originator/Reports";
import OriginatorBranding from "./pages/originator/Branding";
import OriginatorBorrowers from "./pages/originator/Borrowers";
import OriginatorContracts from "./pages/originator/Contracts";
import OriginatorInvoices from "./pages/originator/Invoices";
import AIInsightsPage from "./pages/originator/AIInsights";
import OriginatorCollections from "./pages/originator/Collections";
import OriginatorFeeConfig from "./pages/originator/FeeConfig";
import BorrowerReports from "./pages/borrower/Reports";
import BorrowerOnboarding from "./pages/borrower/Onboarding";
import BorrowerDocuments from "./pages/borrower/Documents";
import BorrowerInvoices from "./pages/borrower/Invoices";
import BorrowerSettlements from "./pages/borrower/Settlements";
import FunderReports from "./pages/funder/Reports";
import FunderMarketplace from "./pages/funder/Marketplace";
import FunderPortfolio from "./pages/funder/Portfolio";
import FunderSettlements from "./pages/funder/Settlements";
import OriginatorDocuments from "./pages/originator/Documents";
import OriginatorCounterparties from "./pages/originator/Counterparties";
import OriginatorInviteUsers from "./pages/originator/InviteUsers";
import OriginatorBrandingProfiles from "./pages/originator/BrandingProfiles";
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
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/invite/accept" element={<AcceptInvite />} />
              <Route path="/install" element={<Install />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/dpa" element={<DataProcessingAgreement />} />
              <Route path="/verify-invoice" element={<AcceptInvoice />} />

              {/* Protected routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin/organizations" element={<ProtectedRoute requiredRoles={["admin"]}><AdminOrganizations /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requiredRoles={["admin"]}><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/reports" element={<ProtectedRoute requiredRoles={["admin"]}><AdminReports /></ProtectedRoute>} />
              <Route path="/admin/products" element={<ProtectedRoute requiredRoles={["admin"]}><AdminProducts /></ProtectedRoute>} />
              <Route path="/admin/audit-logs" element={<ProtectedRoute requiredRoles={["admin"]}><AdminAuditLogs /></ProtectedRoute>} />

              {/* Originator */}
              <Route path="/originator/borrowers" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorBorrowers /></ProtectedRoute>} />
              <Route path="/originator/contracts" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorContracts /></ProtectedRoute>} />
              <Route path="/originator/invoices" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorInvoices /></ProtectedRoute>} />
              <Route path="/originator/reports" element={<ProtectedRoute requiredRoles={["originator_admin", "originator_user"]}><OriginatorReports /></ProtectedRoute>} />
              <Route path="/originator/branding" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorBranding /></ProtectedRoute>} />
              <Route path="/originator/ai-insights" element={<ProtectedRoute requiredRoles={["originator_admin", "originator_user"]}><AIInsightsPage /></ProtectedRoute>} />
              <Route path="/originator/documents" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorDocuments /></ProtectedRoute>} />
              <Route path="/originator/collections" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorCollections /></ProtectedRoute>} />
              <Route path="/originator/fee-config" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorFeeConfig /></ProtectedRoute>} />
              <Route path="/originator/counterparties" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorCounterparties /></ProtectedRoute>} />
              <Route path="/originator/invite" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorInviteUsers /></ProtectedRoute>} />
              <Route path="/originator/branding-profiles" element={<ProtectedRoute requiredRoles={["originator_admin"]}><OriginatorBrandingProfiles /></ProtectedRoute>} />

              {/* Broker (reuses originator components with read-only fee config) */}
              <Route path="/broker/borrowers" element={<ProtectedRoute requiredRoles={["broker_admin"]}><OriginatorBorrowers /></ProtectedRoute>} />
              <Route path="/broker/contracts" element={<ProtectedRoute requiredRoles={["broker_admin"]}><OriginatorContracts /></ProtectedRoute>} />
              <Route path="/broker/invoices" element={<ProtectedRoute requiredRoles={["broker_admin"]}><OriginatorInvoices /></ProtectedRoute>} />
              <Route path="/broker/collections" element={<ProtectedRoute requiredRoles={["broker_admin"]}><OriginatorCollections /></ProtectedRoute>} />
              <Route path="/broker/fee-config" element={<ProtectedRoute requiredRoles={["broker_admin"]}><OriginatorFeeConfig /></ProtectedRoute>} />
              <Route path="/broker/documents" element={<ProtectedRoute requiredRoles={["broker_admin"]}><OriginatorDocuments /></ProtectedRoute>} />
              <Route path="/broker/reports" element={<ProtectedRoute requiredRoles={["broker_admin"]}><OriginatorReports /></ProtectedRoute>} />
              <Route path="/broker/branding" element={<ProtectedRoute requiredRoles={["broker_admin"]}><OriginatorBranding /></ProtectedRoute>} />

              {/* Borrower */}
              <Route path="/borrower/documents" element={<ProtectedRoute requiredRoles={["borrower"]}><BorrowerDocuments /></ProtectedRoute>} />
              <Route path="/borrower/invoices" element={<ProtectedRoute requiredRoles={["borrower"]}><BorrowerInvoices /></ProtectedRoute>} />
              <Route path="/borrower/reports" element={<ProtectedRoute requiredRoles={["borrower"]}><BorrowerReports /></ProtectedRoute>} />
              <Route path="/borrower/onboarding" element={<ProtectedRoute requiredRoles={["borrower"]}><BorrowerOnboarding /></ProtectedRoute>} />
              <Route path="/borrower/settlements" element={<ProtectedRoute requiredRoles={["borrower"]}><BorrowerSettlements /></ProtectedRoute>} />

              {/* Funder */}
              <Route path="/funder/marketplace" element={<ProtectedRoute requiredRoles={["funder"]}><FunderMarketplace /></ProtectedRoute>} />
              <Route path="/funder/portfolio" element={<ProtectedRoute requiredRoles={["funder"]}><FunderPortfolio /></ProtectedRoute>} />
              <Route path="/funder/reports" element={<ProtectedRoute requiredRoles={["funder"]}><FunderReports /></ProtectedRoute>} />
              <Route path="/funder/settlements" element={<ProtectedRoute requiredRoles={["funder"]}><FunderSettlements /></ProtectedRoute>} />

              {/* Counterparty */}
              <Route path="/counterparty/dashboard" element={<ProtectedRoute><CounterpartyDashboard /></ProtectedRoute>} />

              {/* Settings */}
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/settings/security" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </BrandingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
