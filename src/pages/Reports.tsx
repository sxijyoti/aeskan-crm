import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ReportsDashboard from "@/components/reports/ReportsDashboard";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ReportsPage = () => {
  const { loading } = useAuth();

  if (loading) return null; // allow auth to finish

  // Always render the reports dashboard; it internally scopes what non-admins can see.
  return (
    <DashboardLayout title="Reports">
      <ReportsDashboard />
    </DashboardLayout>
  );
};

export default ReportsPage;
