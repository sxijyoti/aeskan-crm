import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseId: string | null;
  onSaved?: () => void;
};

const PurchaseDialog = ({ open, onOpenChange, purchaseId, onSaved }: Props) => {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const load = async () => {
      if (!purchaseId) return;
      setFetching(true);
      try {
        const { data, error } = await supabase.from("purchases").select("*").eq("id", purchaseId).single();
        if (error) throw error;
        const p = data as any;
        setItem(p.item || "");
        setQuantity(p.quantity ?? 1);
        // stored amount is total (amount = unitPrice * quantity); show unit price in UI
        const unit = p.quantity ? Number(p.amount ?? 0) / Number(p.quantity) : Number(p.amount ?? 0);
        setAmount(unit ? String(unit) : "");
        setDate(p.purchase_date ? p.purchase_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load purchase");
      } finally {
        setFetching(false);
      }
    };

    if (open && purchaseId) void load();
    if (!open) {
      // reset
      setItem("");
      setAmount("");
      setQuantity(1);
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, purchaseId]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!purchaseId) return;
    if (!item.trim()) return toast.error("Item is required");
    const unit = Number(amount);
    if (isNaN(unit) || unit <= 0) return toast.error("Enter a valid amount");
    const qty = typeof quantity === "number" ? quantity : Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) return toast.error("Enter a valid quantity");

    setLoading(true);
    try {
      const total = unit * qty;
      const { error } = await supabase.from("purchases").update({ item: item.trim(), amount: total, quantity: qty, purchase_date: date }).eq("id", purchaseId);
      if (error) throw error;
      toast.success("Purchase updated");
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update purchase");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full">
        <DialogHeader>
          <DialogTitle>{purchaseId ? "Edit Purchase" : "Purchase"}</DialogTitle>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item">Item</Label>
              <Input id="item" value={item} onChange={(e) => setItem(e.target.value)} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="amount">Unit Amount</Label>
                <Input id="amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="qty">Quantity</Label>
                <Input id="qty" type="number" step="1" min="1" value={quantity === "" ? "" : String(quantity)} onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))} required />
              </div>
            </div>

            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseDialog;
