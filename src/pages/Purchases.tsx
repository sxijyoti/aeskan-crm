import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
}

interface Purchase {
  id: string;
  contact_id?: string;
  item?: string;
  amount?: number;
  date?: string;
}

const Purchases = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [allPurchases, setAllPurchases] = useState<Array<{ id: string; contact_id?: string; item?: string; amount?: number; date?: string; customer?: string }>>([]);
  const [purchasesAvailable, setPurchasesAvailable] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [form, setForm] = useState({ contact_id: "", item: "", amount: "", date: "" });
  const [errors, setErrors] = useState<{ contact_id?: string; item?: string; amount?: string; date?: string }>({});
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null);

  useEffect(() => {
    fetchContacts();
    fetchPurchases();
    // initial joined fetch
    fetchAllPurchases(sortBy, sortDir);
  }, []);

  // debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setIsSearching(!!debouncedSearch);
    fetchAllPurchases(sortBy, sortDir, debouncedSearch);
  }, [debouncedSearch]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase.from("contacts").select("id,name").order("name");
      if (error) throw error;
      setContacts(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to load contacts");
    }
  };

  const fetchPurchases = async () => {
    try {
      // purchases may not exist in types; cast locally
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as unknown as any)
        .from("purchases")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      setPurchases(data || []);
    } catch (err: any) {
      // if table doesn't exist, mark as unavailable and show friendly UI
      const isNotFound = err?.status === 404 || err?.statusCode === 404 || String(err).includes("404");
      if (isNotFound) {
        setPurchasesAvailable(false);
      } else {
        console.warn("Could not fetch purchases:", err);
      }
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPurchases = async (sortField: "date" | "amount", direction: "asc" | "desc", q?: string) => {
    try {
      // join purchases with contacts to show customer name
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let builder: any = (supabase as unknown as any).from("purchases").select("id,item,amount,date,contact_id,contacts(name)").order(sortField, { ascending: direction === "asc" });
      if (q && q.length > 0) {
        const pattern = `%${q}%`;
        // server-side filter by item or contact name
        builder = builder.or(`item.ilike.${pattern},contacts.name.ilike.${pattern}`);
      }
      const { data, error } = await builder;

      if (error) throw error;
      // normalize results: contact name may come as contacts: { name }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized = (data || []).map((r: any) => ({
        id: r.id,
        contact_id: r.contact_id,
        item: r.item,
        amount: r.amount,
        date: r.date,
        customer: r.contacts?.name || "-",
      }));
      setAllPurchases(normalized);
    } catch (err: any) {
      const isNotFound = err?.status === 404 || err?.statusCode === 404 || String(err).includes("404");
      if (isNotFound) {
        setPurchasesAvailable(false);
      } else {
        console.warn("Could not fetch all purchases:", err);
      }
      setAllPurchases([]);
    }
  };

  useEffect(() => {
    // fetch joined purchases when sort changes
    fetchAllPurchases(sortBy, sortDir);
  }, [sortBy, sortDir]);

  const validate = () => {
    const e: typeof errors = {};
    if (!form.contact_id) e.contact_id = "Select a contact";
    if (!form.item.trim()) e.item = "Item is required";
    if (!form.amount || Number(form.amount) <= 0) e.amount = "Enter a valid amount";
    if (!form.date) e.date = "Date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        contact_id: form.contact_id,
        item: form.item,
        amount: Number(form.amount),
        date: form.date,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as unknown as any).from("purchases").insert([payload]);
      if (error) throw error;
      toast.success("Purchase recorded successfully");
      setForm({ contact_id: "", item: "", amount: "", date: "" });
      fetchPurchases();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to record purchase");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (v?: number) =>
    v != null
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v)
      : "-";
  const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : "-");

  const handleEdit = (p: Purchase) => {
    setEditingPurchase(p);
    setForm({ contact_id: p.contact_id || "", item: p.item || "", amount: p.amount ? String(p.amount) : "", date: p.date || "" });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPurchase) return;
    if (!validate()) return;
    setIsUpdating(true);
    try {
      const payload = {
        contact_id: form.contact_id,
        item: form.item,
        amount: Number(form.amount),
        date: form.date,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as unknown as any).from("purchases").update(payload).eq("id", editingPurchase.id);
      if (error) throw error;
      toast.success("Purchase updated");
      setEditingPurchase(null);
      setForm({ contact_id: "", item: "", amount: "", date: "" });
      fetchPurchases();
      fetchAllPurchases(sortBy, sortDir, debouncedSearch);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to update purchase");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as unknown as any).from("purchases").delete().eq("id", id);
      if (error) throw error;
      toast.success("Purchase deleted");
      setDeletingPurchase(null);
      fetchPurchases();
      fetchAllPurchases(sortBy, sortDir, debouncedSearch);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to delete purchase");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Purchases
        </h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Purchase</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact">Contact</Label>
              <select
                id="contact"
                className="w-full rounded-md border bg-card px-3 py-2"
                value={form.contact_id}
                onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
              >
                <option value="">Select contact</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="item">Item</Label>
              <Input id="item" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
              {errors.item && <p className="text-sm text-destructive">{errors.item}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
            </div>

            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" className="w-full md:w-48" disabled={isSubmitting}>
                {isSubmitting ? "Recording..." : "Record Purchase"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Purchases</CardTitle>
            <div className="flex items-center gap-2">
                <Input
                  aria-label="Search purchases"
                  placeholder="Search by item or customer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-2 py-1 w-48"
                />
              <label className="text-sm text-muted-foreground">Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "date" | "amount")}
                className="rounded-md border bg-card px-2 py-1">
                <option value="date">Date</option>
                <option value="amount">Amount</option>
              </select>
              <button
                className="px-2 py-1 rounded-md border bg-card"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                title="Toggle sort direction"
              >
                {sortDir === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : purchasesAvailable === false ? (
            <div className="text-sm text-muted-foreground">
              <p>The <code>purchases</code> table was not found in your Supabase project.</p>
              <p className="mt-2">Create the table (via Supabase dashboard or SQL) to enable purchase records. Example SQL:</p>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">{`CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  item text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL,
  created_at timestamptz DEFAULT now()
);`}</pre>
            </div>
          ) : allPurchases.length === 0 ? (
            <p className="text-muted-foreground">No purchases recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="text-sm text-muted-foreground text-left">
                    <th className="py-2">Customer</th>
                    <th className="py-2">Item</th>
                    <th className="py-2">Date</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allPurchases.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-3">{p.customer}</td>
                      <td className="py-3">{p.item}</td>
                      <td className="py-3 text-sm text-muted-foreground">{formatDate(p.date)}</td>
                      <td className="py-3 text-right font-semibold">{formatCurrency(p.amount)}</td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleEdit({ id: p.id, contact_id: p.contact_id, item: p.item, amount: p.amount, date: p.date }); }}
                          >
                            Edit
                          </Button>

                          <AlertDialog open={deletingPurchase?.id === p.id}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setDeletingPurchase({ id: p.id, item: p.item, amount: p.amount, date: p.date }); }}
                              >
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete purchase</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this purchase <strong>{p.item}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="flex justify-end gap-2 mt-4">
                                <AlertDialogCancel onClick={() => setDeletingPurchase(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deletingPurchase && handleDelete(deletingPurchase.id)}>Delete</AlertDialogAction>
                              </div>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingPurchase} onOpenChange={(open) => { if (!open) setEditingPurchase(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Purchase</DialogTitle>
            <DialogDescription>Update the purchase details below.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editContact">Contact</Label>
                <select
                  id="editContact"
                  className="w-full rounded-md border bg-card px-3 py-2"
                  value={form.contact_id}
                  onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
                >
                  <option value="">Select contact</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.contact_id && <p className="text-sm text-destructive">{errors.contact_id}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="editItem">Item</Label>
                <Input id="editItem" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
                {errors.item && <p className="text-sm text-destructive">{errors.item}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editAmount">Amount</Label>
                <Input id="editAmount" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                {errors.amount && <p className="text-sm text-destructive">{errors.amount}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDate">Date</Label>
                <Input id="editDate" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                {errors.date && <p className="text-sm text-destructive">{errors.date}</p>}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>{isUpdating ? "Updating..." : "Update Purchase"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Purchases;
