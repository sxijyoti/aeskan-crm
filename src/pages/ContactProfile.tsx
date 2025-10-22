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

  useEffect(() => {
    if (!id) return;
    fetchContact(id);
    fetchPurchases(id);
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

      setPurchases(data || []);
    } catch (error: unknown) {
      console.warn(error);
      setPurchases([]);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">{contact.name}</h2>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <CardTitle>Purchase History</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-muted-foreground">No purchases found for this contact.</p>
          ) : (
            <div className="space-y-2">
              {purchases.map((p) => (
                <div key={p.id} className="p-3 border rounded-md">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{p.description || "Purchase"}</p>
                      <p className="text-sm text-muted-foreground">{p.created_at}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{p.amount ? `$${p.amount}` : "-"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactProfile;
