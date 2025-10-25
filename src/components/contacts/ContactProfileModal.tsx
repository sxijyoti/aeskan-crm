import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatINR } from "@/lib/utils";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  company_id: string;
  created_by?: string | null;
  assigned_user_id?: string | null;
};

type Purchase = {
  id: string;
  item: string;
  amount: number;
  purchase_date: string;
};

type Voucher = {
  id: string;
  code: string;
  status: string;
  issued_at: string;
  redeemed_at: string | null;
  voucher_rule?: { name?: string } | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
}

const ContactProfileModal = ({ open, onOpenChange, contactId }: Props) => {
  const { profile, user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<Contact | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  const fetch = useCallback(async () => {
    if (!contactId || !profile) return;
    setLoading(true);
    try {
      const { data: contactData, error: contactError } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .eq("company_id", profile.company_id)
        .single();

      if (contactError) throw contactError;

      const { data: purchasesData, error: purchasesError } = await supabase
        .from("purchases")
        .select("*")
        .eq("contact_id", contactId)
        .eq("company_id", profile.company_id)
        .order("purchase_date", { ascending: false });

      if (purchasesError) throw purchasesError;

      const { data: vouchersData, error: vouchersError } = await supabase
        .from("vouchers")
        .select("*, voucher_rules(name)")
        .eq("contact_id", contactId)
        .eq("company_id", profile.company_id)
        .order("issued_at", { ascending: false });

      if (vouchersError) throw vouchersError;

      setContact(contactData || null);
      setPurchases((purchasesData as Purchase[]) || []);
      setVouchers((vouchersData as Voucher[]) || []);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to load contact");
    } finally {
      setLoading(false);
    }
  }, [contactId, profile]);

  useEffect(() => {
    if (open) void fetch();
  }, [open, fetch]);

  const totalSpend = purchases.reduce((s, p) => s + Number(p.amount || 0), 0);

  const canSeePII = (() => {
    if (!user) return false;
    if (isAdmin) return true;
    if (!contact) return false;
    // remove assigned_user_id from PII gating; only creator or admin can see PII
    return contact.created_by === user.id;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-full">
        <DialogHeader>
          <DialogTitle>{contact ? `Contact — ${contact.name}` : "Contact"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : contact ? (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <Card className="shadow-md mb-4">
                <CardHeader>
                  <CardTitle>Purchases</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="text-left text-sm text-muted-foreground">
                          <th className="py-2">Item</th>
                          <th className="py-2">Amount</th>
                          <th className="py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchases.map((p) => (
                          <tr key={p.id} className="border-t">
                            <td className="py-2">{p.item}</td>
                            <td className="py-2">{formatINR(p.amount)}</td>
                            <td className="py-2">{new Date(p.purchase_date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {purchases.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-muted-foreground">
                              No purchases recorded for this contact.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle>Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <div className="text-sm text-muted-foreground">Name</div>
                    <div className="font-medium">{contact.name}</div>
                  </div>

                  {canSeePII && contact.email && (
                    <div>
                      <div className="text-sm text-muted-foreground">Email</div>
                      <div className="font-medium">{contact.email}</div>
                    </div>
                  )}

                  {canSeePII && contact.phone && (
                    <div>
                      <div className="text-sm text-muted-foreground">Phone</div>
                      <div className="font-medium">{contact.phone}</div>
                    </div>
                  )}

                  {canSeePII && contact.address && (
                    <div>
                      <div className="text-sm text-muted-foreground">Address</div>
                      <div className="font-medium">{contact.address}</div>
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="text-sm text-muted-foreground">Total Spend</div>
                    <div className="text-2xl font-bold">{formatINR(totalSpend)}</div>
                  </div>

                  {vouchers.length > 0 && (
                    <div className="mt-6">
                      <div className="text-sm text-muted-foreground">Vouchers</div>
                      <div className="space-y-2 mt-2">
                        {vouchers.map((v) => (
                          <div key={v.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                            <div>
                              <div className="font-medium">{v.code}</div>
                              <div className="text-sm text-muted-foreground">{v.voucher_rule?.name ?? "—"}</div>
                            </div>
                            <div className="text-sm text-muted-foreground">{v.status}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">Contact not found or you don't have access.</div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContactProfileModal;
