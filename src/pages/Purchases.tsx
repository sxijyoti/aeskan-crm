import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ contact_id: "", item: "", amount: "", date: "" });
  const [errors, setErrors] = useState<{ contact_id?: string; item?: string; amount?: string; date?: string }>({});

  useEffect(() => {
    fetchContacts();
    fetchPurchases();
  }, []);

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
    } catch (err) {
      // if table doesn't exist, silently show empty list
      console.warn("Could not fetch purchases:", err);
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

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

  const formatCurrency = (v?: number) => (v != null ? `$${v.toFixed(2)}` : "-");
  const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : "-");

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
          <CardTitle>Recent Purchases</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : purchases.length === 0 ? (
            <p className="text-muted-foreground">No purchases recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="text-sm text-muted-foreground text-left">
                    <th className="py-2">Item</th>
                    <th className="py-2">Date</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-3">{p.item}</td>
                      <td className="py-3 text-sm text-muted-foreground">{formatDate(p.date)}</td>
                      <td className="py-3 text-right font-semibold">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Purchases;
