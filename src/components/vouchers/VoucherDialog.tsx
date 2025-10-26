import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucherId: string | null;
  onSaved?: () => void;
};

const VoucherDialog = ({ open, onOpenChange, voucherId, onSaved }: Props) => {
  const [fetching, setFetching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("active");

  useEffect(() => {
    const load = async () => {
      if (!voucherId) return;
      setFetching(true);
      try {
        const { data, error } = await supabase.from("vouchers").select("id, status").eq("id", voucherId).single();
        if (error) throw error;
        setStatus((data as any).status ?? "active");
      } catch (err) {
        console.error("load voucher error:", err);
        toast.error("Failed to load voucher");
        onOpenChange(false);
      } finally {
        setFetching(false);
      }
    };

    if (open && voucherId) void load();
    if (!open) setStatus("active");
  }, [open, voucherId]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!voucherId) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("vouchers").update({ status }).eq("id", voucherId);
      if (error) throw error;
      toast.success("Voucher updated");
      onOpenChange(false);
      if (onSaved) onSaved();
    } catch (err) {
      console.error("update voucher error:", err);
      const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
      toast.error(msg || "Failed to update voucher");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Edit Voucher</DialogTitle>
        </DialogHeader>

        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Status</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Issued</option>
                <option value="redeemed">Redeemed</option>
                <option value="expired">Expired</option>
              </select>
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

export default VoucherDialog;
