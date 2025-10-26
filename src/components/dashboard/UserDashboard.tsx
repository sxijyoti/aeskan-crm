import DashboardLayout from "./DashboardLayout";
import ContactsList from "@/components/contacts/ContactsList";

const UserDashboard = () => {
  return (
    <DashboardLayout title="My Dashboard">
      <ContactsList />
    </DashboardLayout>
  );
};

export default UserDashboard;
