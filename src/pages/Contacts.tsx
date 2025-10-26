import ContactsList from "@/components/contacts/ContactsList";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const Contacts = () => {
  return (
    <DashboardLayout title="Customer Contacts">
      <ContactsList />
    </DashboardLayout>
  );
};

export default Contacts;
