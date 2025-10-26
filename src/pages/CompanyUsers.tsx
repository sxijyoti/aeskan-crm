import DashboardLayout from "@/components/dashboard/DashboardLayout";
import CompanyUsers from "@/components/company/CompanyUsers";

const CompanyUsersPage = () => {
  return (
    <DashboardLayout title="Company Users">
      <CompanyUsers />
    </DashboardLayout>
  );
};

export default CompanyUsersPage;
