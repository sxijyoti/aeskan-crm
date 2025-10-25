import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import Purchases from "./pages/Purchases";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import VoucherRules from "./pages/VoucherRules";
import NotFound from "./pages/NotFound";
import ContactProfile from "./pages/ContactProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Dashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/contacts"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Contacts />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
              <Route
                path="/contacts/:id"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <ContactProfile />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
            <Route
              path="/dashboard/purchases"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Purchases />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/reports"
              element={
                <ProtectedRoute>
                  <DashboardLayout>
                    <Reports />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <DashboardLayout>
                    <Admin />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/voucher-rules"
              element={
                <ProtectedRoute requireAdmin>
                  <DashboardLayout>
                    <VoucherRules />
                  </DashboardLayout>
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
