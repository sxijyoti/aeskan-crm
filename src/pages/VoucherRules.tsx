import DashboardLayout from "@/components/dashboard/DashboardLayout";
import VoucherRulesList from "@/components/vouchers/VoucherRulesList";

const VoucherRulesPage = () => {
  return (
    <DashboardLayout title="Voucher Rules">
      <VoucherRulesList />
    </DashboardLayout>
  );
};

export default VoucherRulesPage;
