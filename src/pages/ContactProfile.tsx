import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

interface Purchase {
  id: string;
  contact_id?: string;
  amount?: number;
  description?: string;
  created_at?: string;
}

const ContactProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [totalSpend, setTotalSpend] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchContact(id);
    fetchPurchases(id);
    fetchTotalSpend(id);
  }, [id]);

  const fetchContact = async (contactId: string) => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .single();

      if (error) throw error;
      setContact(data || null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "Failed to load contact");
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async (contactId: string) => {
    try {
      // try common pattern: purchases.contact_id === contactId
      // `purchases` table may not be present in the generated types; cast to any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as unknown as any)
        .from("purchases")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });

      // If the table doesn't exist, supabase-js returns an error; we handle gracefully
      if (error) {
        console.warn("Could not load purchases: ", error);
        setPurchases([]);
        return;
      }

      const rows = data || [];
      setPurchases(rows);

      // compute total spend locally as a fallback and reliable method
      try {
        const total = (rows as any[]).reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
        setTotalSpend(Number.isFinite(total) ? total : 0);
      } catch (err) {
        // if local sum fails, leave totalSpend untouched (fetchTotalSpend will attempt server-side)
        console.warn("Could not compute total locally:", err);
      }
    } catch (error: unknown) {
      console.warn(error);
      setPurchases([]);
    }
  };

  const fetchTotalSpend = async (contactId: string) => {
    try {
      // aggregate sum(amount) for this contact
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as unknown as any)
        .from("purchases")
        .select("sum(amount)")
        .eq("contact_id", contactId);

      if (error) {
        // table might not exist
        console.warn("Could not fetch total spend:", error);
        setTotalSpend(null);
        return;
      }

      // data is usually an array with a single object like { sum: "123.45" } or { sum: null }
      const sumRow = Array.isArray(data) && data.length > 0 ? data[0] : null;
      // sum may be returned as { sum: '123.45' } or similar; be defensive
      let raw: unknown = null;
      if (sumRow) {
        raw = (sumRow as any).sum ?? Object.values(sumRow)[0];
      }
      const value = raw == null ? 0 : Number(raw);
      setTotalSpend(Number.isFinite(value) ? value : 0);
    } catch (err) {
      console.warn(err);
      setTotalSpend(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">Contact Not Found</h2>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">{contact.name}</h2>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{contact.email || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{contact.phone || "-"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium">{contact.address || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Spend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">All-time total</p>
              <p className="text-2xl font-bold">
                {totalSpend == null ? (
                  <span className="text-muted-foreground">Unavailable</span>
                ) : (
                  <span className="text-primary">${totalSpend.toFixed(2)}</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchase History</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-muted-foreground">No purchases found for this contact.</p>
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
                      <td className="py-3">{p.description || "Purchase"}</td>
                      <td className="py-3 text-sm text-muted-foreground">{p.created_at}</td>
                      <td className="py-3 text-right font-semibold">{p.amount ? `$${p.amount.toFixed(2)}` : "-"}</td>
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

export default ContactProfile;
