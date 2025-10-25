import DashboardLayout from "@/components/dashboard/DashboardLayout";
import RecordPurchase from "@/components/purchases/RecordPurchase";

const RecordPurchasePage = () => {
  return (
    <DashboardLayout title="Record Purchase">
      <div className="bg-card p-6 rounded-md shadow-sm">
        <RecordPurchase onSaved={() => { /* TODO: navigate or refresh purchases */ }} />
      </div>
    </DashboardLayout>
  );
};

export default RecordPurchasePage;
