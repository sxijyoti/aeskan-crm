import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const StatCard = ({ title, value, loading }: { title: string; value: string; loading?: boolean }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{loading ? "..." : value}</div>
    </CardContent>
  </Card>
);

const Reports = () => {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contactsCount, setContactsCount] = useState<number | null>(null);
  const [purchasesCount, setPurchasesCount] = useState<number | null>(null);
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);

  const formatCurrency = (v?: number | null) =>
    v != null ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v) : "-";

  const fetchStats = async () => {
    setLoading(true);
    try {
      // contacts count
      const { count: cCount, error: cErr } = await supabase.from("contacts").select("id", { count: "exact", head: true });
      if (cErr) {
        console.warn("contacts count error", cErr);
        setContactsCount(null);
      } else {
        setContactsCount(typeof cCount === "number" ? cCount : null);
      }

      // purchases count and revenue
      const { count: pCount, error: pCountErr } = await (supabase as unknown as any)
        .from("purchases")
        .select("id", { count: "exact", head: true });
      if (pCountErr) {
        console.warn("purchases count error", pCountErr);
        setPurchasesCount(null);
      } else {
        setPurchasesCount(typeof pCount === "number" ? pCount : null);
      }

      const { data: sumData, error: sumErr } = await (supabase as unknown as any)
        .from("purchases")
        .select("sum(amount)");
      if (sumErr) {
        console.warn("purchases sum error", sumErr);
        setTotalRevenue(null);
      } else {
        const sumRow = Array.isArray(sumData) && sumData.length > 0 ? sumData[0] : null;
        const raw = sumRow ? (sumRow as any).sum ?? Object.values(sumRow)[0] : null;
        const value = raw == null ? 0 : Number(raw);
        setTotalRevenue(Number.isFinite(value) ? value : null);
      }
    } catch (err) {
      console.warn(err);
      setContactsCount(null);
      setPurchasesCount(null);
      setTotalRevenue(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (userRole !== "admin") {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">Reports</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Analytics & Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Access denied — admin only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Reports</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Contacts" value={contactsCount?.toString() ?? "-"} loading={loading} />
        <StatCard title="Total Purchases" value={purchasesCount?.toString() ?? "-"} loading={loading} />
        <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} loading={loading} />
      </div>

      <div className="pt-4">
        <Button onClick={fetchStats} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
    </div>
  );
};

export default Reports;
