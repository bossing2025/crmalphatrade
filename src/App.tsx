import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { SidebarStateProvider } from "@/hooks/useSidebarState";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Affiliates from "./pages/Affiliates";
import AffiliatePerformance from "./pages/AffiliatePerformance";
import Advertisers from "./pages/Advertisers";
import AdvertiserPerformance from "./pages/AdvertiserPerformance";
import Distributions from "./pages/Distributions";
import DistributionSettings from "./pages/DistributionSettings";
import RejectedLeads from "./pages/RejectedLeads";
import TestLeadLogs from "./pages/TestLeadLogs";
import Reports from "./pages/Reports";
import Conversions from "./pages/Conversions";
import CountryPerformance from "./pages/CountryPerformance";
import Monitoring from "./pages/Monitoring";
import Settings from "./pages/Settings";
import ApiDocs from "./pages/ApiDocs";
import Users from "./pages/Users";
import LeadPools from "./pages/LeadPools";
import LeadPoolDetail from "./pages/LeadPoolDetail";
import InjectionDashboard from "./pages/InjectionDashboard";
import InjectionJobs from "./pages/InjectionJobs";
import InjectionDetail from "./pages/InjectionDetail";
import InjectionLeads from "./pages/InjectionLeads";
import InjectionFailedLeads from "./pages/InjectionFailedLeads";
import SendHistory from "./pages/SendHistory";
import AffiliateRejectedLeads from "./pages/AffiliateRejectedLeads";

import AuditLogs from "./pages/AuditLogs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <SidebarStateProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/affiliates" element={<Affiliates />} />
                <Route path="/affiliate-performance" element={<AffiliatePerformance />} />
                <Route path="/advertisers" element={<Advertisers />} />
                <Route path="/advertiser-performance" element={<AdvertiserPerformance />} />
                <Route path="/distributions" element={<Distributions />} />
                <Route path="/distribution-settings" element={<DistributionSettings />} />
                <Route path="/rejected-leads" element={<RejectedLeads />} />
                <Route path="/test-logs" element={<TestLeadLogs />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/conversions" element={<Conversions />} />
                <Route path="/country-performance" element={<CountryPerformance />} />
                <Route path="/monitoring" element={<Monitoring />} />
                <Route path="/users" element={<Users />} />
                <Route path="/lead-pools" element={<LeadPools />} />
                <Route path="/lead-pools/:id" element={<LeadPoolDetail />} />
                <Route path="/injections" element={<InjectionDashboard />} />
                <Route path="/injections/jobs" element={<InjectionJobs />} />
                <Route path="/injections/leads" element={<InjectionLeads />} />
                <Route path="/injections/failed" element={<InjectionFailedLeads />} />
                <Route path="/injections/send-history" element={<SendHistory />} />
                <Route path="/injections/:id" element={<InjectionDetail />} />
                <Route path="/affiliate-rejected" element={<AffiliateRejectedLeads />} />
                
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </SidebarStateProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;