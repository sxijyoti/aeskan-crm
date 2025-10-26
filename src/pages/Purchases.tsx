import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ChevronDown, ChevronUp, Search, Edit2, Trash2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PurchaseDialog from "@/components/purchases/PurchaseDialog";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import RecordPurchase from "@/components/purchases/RecordPurchase";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

type PurchaseJoined = {
  id: string;
  item: string;
  amount: number;
  purchase_date: string;
  contacts: {
    id: string;
    name: string;
    assigned_user_id?: string | null;
  } | null;
};

const PurchasesPage = () => {
  const { profile, isAdmin, user } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseJoined[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [confirmPurchaseOpen, setConfirmPurchaseOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);

  const fetchPurchases = useCallback(async (term?: string) => {
    if (!profile) return;
    setLoading(true);

    try {
      // Build base query: join contacts to get customer name
      let query = supabase
        .from("purchases")
        .select("id, item, amount, purchase_date, contacts(id, name, assigned_user_id)")
        .eq("company_id", profile.company_id);

      // Role-based filter: non-admins only see purchases for contacts assigned to them
      if (!isAdmin && user) {
        query = query.eq("contacts.assigned_user_id", user.id);
      }

      // Search by item or customer name
      if (term && term.trim()) {
        const t = term.trim();
        query = query.or(`item.ilike.%${t}%,contacts.name.ilike.%${t}%`);
      }

      const orderCol = sortBy === "date" ? "purchase_date" : "amount";
      query = query.order(orderCol, { ascending: sortAsc });

      const { data, error } = await query;
      if (error) {
        console.error(error);
        setPurchases([]);
      } else {
        setPurchases((data as PurchaseJoined[]) || []);
      }
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin, user, sortBy, sortAsc]);

  useEffect(() => {
    void fetchPurchases();
  }, [fetchPurchases]);

  // debounce searchTerm and refetch
  useEffect(() => {
    const id = setTimeout(() => void fetchPurchases(searchTerm), 300);
    return () => clearTimeout(id);
  }, [searchTerm, fetchPurchases]);

  const toggleSort = (col: "date" | "amount") => {
    if (sortBy === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(col);
      setSortAsc(false);
    }
  };

  return (
    <DashboardLayout title="Purchases">
      <div className="space-y-6">
        <div className="bg-card p-4 rounded-md shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Record a Purchase</h3>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ) : (
            <RecordPurchase onSaved={fetchPurchases} />
          )}
        </div>

        <div className="overflow-x-auto bg-card p-4 rounded-md shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-1/3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input className="pl-10" placeholder="Search purchases or customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </div>
          {loading ? (
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3">&nbsp;</th>
                  <th className="px-4 py-3">&nbsp;</th>
                  <th className="px-4 py-3">&nbsp;</th>
                  <th className="px-4 py-3">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-sm text-muted-foreground">
                  <th className="px-4 py-3 text-left">Customer Name</th>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort("amount")}>
                      Amount
                      {sortBy === "amount" ? (sortAsc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button className="inline-flex items-center gap-1" onClick={() => toggleSort("date")}>
                      Date
                      {sortBy === "date" ? (sortAsc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/5">
                    <td className="px-4 py-3">{p.contacts?.name ?? "Unknown"}</td>
                    <td className="px-4 py-3">{p.item}</td>
                    <td className="px-4 py-3">{formatINR(p.amount)}</td>
                    <td className="px-4 py-3">{new Date(p.purchase_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingPurchaseId(p.id); setEditingOpen(true); }} aria-label="Edit purchase">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setPurchaseToDelete(p.id); setConfirmPurchaseOpen(true); }} aria-label="Delete purchase">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">No purchases found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <PurchaseDialog open={editingOpen} onOpenChange={(open) => { setEditingOpen(open); if (!open) setEditingPurchaseId(null); }} purchaseId={editingPurchaseId} onSaved={() => void fetchPurchases()} />
      <ConfirmDialog
        open={confirmPurchaseOpen}
        onOpenChange={(open) => setConfirmPurchaseOpen(open)}
        title="Delete purchase"
        description="Are you sure you want to delete this purchase? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!purchaseToDelete) return;
          try {
            const { error } = await supabase.from("purchases").delete().eq("id", purchaseToDelete);
            if (error) throw error;
            toast.success("Purchase deleted");
            void fetchPurchases();
          } catch (err) {
            console.error(err);
            toast.error("Failed to delete purchase");
          } finally {
            setPurchaseToDelete(null);
          }
        }}
      />
    </DashboardLayout>
  );
};

export default PurchasesPage;
