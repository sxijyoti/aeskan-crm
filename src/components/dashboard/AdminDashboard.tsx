import DashboardLayout from "./DashboardLayout";
import ContactsList from "@/components/contacts/ContactsList";

const AdminDashboard = () => {
  return (
    <DashboardLayout title="Admin Dashboard">
      <ContactsList />
    </DashboardLayout>
  );
};

export default AdminDashboard;
