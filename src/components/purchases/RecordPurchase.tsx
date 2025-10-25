import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ContactOption = { id: string; name: string };

type Props = {
  onSaved?: () => void;
};

const RecordPurchase = ({ onSaved }: Props) => {
  const { user, profile, isAdmin } = useAuth();
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactPage, setContactPage] = useState(0);
  const pageSize = 20;
  const [hasMoreContacts, setHasMoreContacts] = useState(false);
  
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactId, setContactId] = useState<string>("");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchContacts = async (page = 0) => {
      if (!profile) return;

      type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];

      setLoadingContacts(true);
      let query = supabase
        .from("contacts")
        .select("id, name, created_by, assigned_user_id")
        .eq("company_id", profile.company_id)
        .order("name", { ascending: true })
        .range(page * pageSize, page * pageSize + pageSize - 1);

      // no client-side search: keep dropdown-only selection (server-side paginated)

      if (!isAdmin && user) {
        // users can only record for contacts they created or are assigned to
        query = query.or(`created_by.eq.${user.id},assigned_user_id.eq.${user.id}`);
      }

  const res = await query;
      const data = res.data as ContactRow[] | null;
      const error = res.error;
      if (error) {
        console.error(error);
        toast.error("Failed to load contacts");
        if (page === 0) setContacts([]);
        setHasMoreContacts(false);
      } else {
        const rows: ContactRow[] = data ?? [];
        if (page === 0) setContacts(rows.map((c) => ({ id: c.id, name: c.name })));
        else setContacts((prev) => [...prev, ...rows.map((c) => ({ id: c.id, name: c.name }))]);

        setHasMoreContacts(rows.length === pageSize);
        // Do not auto-select a contact; require explicit user selection
      }
      setLoadingContacts(false);
    };

    void fetchContacts(contactPage);
  }, [profile, isAdmin, user, contactPage, contactId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (!contactId) {
      toast.error("Please select a contact");
      return;
    }
    if (!item.trim()) {
      toast.error("Item is required");
      return;
    }
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (!date) {
      toast.error("Please select a date");
      return;
    }

    setLoading(true);

    try {
      const toInsert: Database["public"]["Tables"]["purchases"]["Insert"] = {
        company_id: profile.company_id,
        contact_id: contactId,
        created_by: user.id,
        item: item.trim(),
        amount: amt,
        quantity: qty,
        purchase_date: date,
      };

      const { error } = await supabase.from("purchases").insert(toInsert);
      if (error) throw error;

      toast.success("Purchase recorded successfully");
      setItem("");
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      if (onSaved) onSaved();
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-12">
      {/* Row 1: Contact (left) and Item (right) */}
      <div className="md:col-span-8">
        <Label htmlFor="contact" className="text-sm font-medium">Contact</Label>
        <select
          id="contact"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
        >
          <option value="" disabled>Select a contact</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
          <div>{contacts.length === 0 ? "No contacts" : `${contacts.length} shown`}</div>
          <div>{hasMoreContacts && (
            <Button size="sm" onClick={() => setContactPage((p) => p + 1)} disabled={loadingContacts}>
              {loadingContacts ? "Loading..." : "Load more"}
            </Button>
          )}</div>
        </div>
      </div>

      <div className="md:col-span-4">
        <Label htmlFor="item" className="text-sm font-medium">Item</Label>
        <Input id="item" className="mt-1 h-10" value={item} onChange={(e) => setItem(e.target.value)} required />
      </div>

      {/* Row 2: Amount, Date, Action */}
      <div className="md:col-span-3">
        <Label htmlFor="amount" className="text-sm font-medium">Amount</Label>
        <Input id="amount" type="number" step="0.01" min="0" className="mt-1 h-10" value={amount} onChange={(e) => setAmount(e.target.value)} required />
      </div>

      <div className="md:col-span-3">
        <Label htmlFor="quantity" className="text-sm font-medium">Quantity</Label>
        <Input id="quantity" type="number" step="1" min="1" className="mt-1 h-10" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
      </div>

      <div className="md:col-span-3">
        <Label htmlFor="date" className="text-sm font-medium">Date</Label>
        <Input id="date" type="date" className="mt-1 h-10" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <div className="md:col-span-3 flex items-center justify-end">
        <Button type="submit" className="h-10" disabled={loading}>{loading ? "Recording..." : "Record Purchase"}</Button>
      </div>
    </form>
  );
};

export default RecordPurchase;
