import { useCallback, useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import PurchaseDialog from "@/components/purchases/PurchaseDialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  company_id: string;
};

type Purchase = {
  id: string;
  item: string;
  amount: number;
  purchase_date: string;
  created_at: string;
};

type Voucher = {
  id: string;
  code: string;
  status: string;
  issued_at: string;
  redeemed_at: string | null;
  voucher_rule?: { name?: string } | null;
};

const ContactProfile = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const idFromState = (location.state as { id?: string } | null)?.id;
  const id = idFromState ?? params.id;
  const { user, profile, isAdmin } = useAuth();
  // Contact may include assignment metadata
  type ContactWithAssignment = Contact & { assigned_user_id?: string | null; created_by?: string | null };
  const [contact, setContact] = useState<ContactWithAssignment | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalsAllowed, setTotalsAllowed] = useState(false);
  const [assignedUserName, setAssignedUserName] = useState<string | null>(null);

  // purchase form state
  const [item, setItem] = useState("");

  const formatVoucherStatus = (s: string | undefined | null) => {
    if (!s) return "—";
    switch (s) {
      case "active":
        return "Issued";
      case "redeemed":
        return "Redeemed";
      case "expired":
        return "Expired";
      default:
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
  };
  const [confirmPurchaseOpen, setConfirmPurchaseOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const fetchContactAndPurchases = useCallback(async () => {
    if (!id || !profile) return;
    setLoading(true);

    try {
      const { data: contactData, error: contactError } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", id)
        .eq("company_id", profile.company_id)
        .single();

      if (contactError) throw contactError;

      const contactRow = contactData as ContactWithAssignment;
      setContact(contactRow || null);

      // Role-based access: non-admin users can only see totals for assigned contacts
      const allowed = Boolean(isAdmin || (user && contactRow && contactRow.assigned_user_id === user.id));
      setTotalsAllowed(allowed);

      // if viewer is admin, fetch the assigned user's display name for the details card
      if (isAdmin && contactRow?.assigned_user_id) {
        try {
          const { data: profileData, error: profileErr } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", contactRow.assigned_user_id)
            .single();
          if (!profileErr && profileData) {
            setAssignedUserName((profileData as { full_name?: string | null }).full_name ?? null);
          } else {
            setAssignedUserName(null);
          }
        } catch (err) {
          console.error(err);
          setAssignedUserName(null);
        }
      } else {
        setAssignedUserName(null);
      }

      let purchasesData: Purchase[] = [];
      if (allowed) {
        const purchasesRes = await supabase
          .from("purchases")
          .select("*")
          .eq("contact_id", id)
          .eq("company_id", profile.company_id)
          .order("purchase_date", { ascending: false });

        if (purchasesRes.error) throw purchasesRes.error;
        purchasesData = (purchasesRes.data as Purchase[]) || [];
      } else {
        purchasesData = [];
      }

      const { data: vouchersData, error: vouchersError } = await supabase
        .from("vouchers")
        .select("*, voucher_rules(name)")
        .eq("contact_id", id)
        .eq("company_id", profile.company_id)
        .order("issued_at", { ascending: false });

      if (vouchersError) throw vouchersError;

      setPurchases(purchasesData || []);
      setVouchers((vouchersData as Voucher[]) || []);
    } catch (error: unknown) {
      if (error instanceof Error) console.error(error);
      else console.error(String(error));
      toast.error("Failed to load customer contact or purchases");
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => {
    void fetchContactAndPurchases();
  }, [fetchContactAndPurchases]);

  const totalSpend = purchases.reduce((s, p) => s + Number(p.amount || 0), 0);

  const canIssueVoucher = Boolean(isAdmin || (user && contact && (contact.created_by === user.id || contact.assigned_user_id === user.id)));

  // Issue voucher state
  const [issueOpen, setIssueOpen] = useState(false);
  const [rulesOptions, setRulesOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [editingOpen, setEditingOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  const openIssue = async () => {
    if (!profile) return;
    setSelectedRuleId(null);
    setIssueOpen(true);
    try {
      const { data, error } = await supabase
        .from("voucher_rules")
        .select("id, name")
        .eq("company_id", profile.company_id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRulesOptions((data as Array<{ id: string; name: string }>) || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load voucher rules");
      setRulesOptions([]);
    }
  };

  const handleIssueVoucher = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedRuleId || !profile || !user || !contact) return;
    setIssueLoading(true);
    try {
      const code = `V-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
      const toInsert = {
        code,
        company_id: profile.company_id,
        contact_id: contact.id,
        issued_by: user.id,
        voucher_rule_id: selectedRuleId,
        status: "active",
      };
      const { error } = await supabase.from("vouchers").insert(toInsert);
      if (error) throw error;
    toast.success("Voucher issued to customer contact");
      setIssueOpen(false);
      // refresh vouchers list
      void fetchContactAndPurchases();
    } catch (err) {
      console.error("issue voucher error:", err);
      const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
      toast.error(msg || "Failed to issue voucher");
    } finally {
      setIssueLoading(false);
    }
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !user || !profile) return;

    const insert: {
      company_id: string;
      contact_id: string;
      created_by: string;
      item: string;
      amount: number;
      quantity?: number;
      purchase_date: string;
    } = {
      company_id: profile.company_id,
      contact_id: contact.id,
      created_by: user.id,
      item,
      // store total amount = unit price * quantity
      amount: (typeof amount === "number" ? amount : Number(amount)) * (typeof quantity === "number" ? quantity : Number(quantity)),
      quantity: typeof quantity === "number" ? quantity : Number(quantity),
      purchase_date: date,
    };

    try {
      const { error } = await supabase.from("purchases").insert(insert);
      if (error) throw error;
      toast.success("Purchase recorded");
      setItem("");
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      fetchContactAndPurchases();
    } catch (error: unknown) {
      if (error instanceof Error) toast.error(error.message);
      else toast.error(String(error));
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Customer Contact">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!contact) {
    return (
      <DashboardLayout title="Customer Contact">
        <div className="text-center py-12">Customer Contact not found or you don't have access.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Customer Contact: ${contact.name}`}>
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
          ← Back
        </Button>
      </div>
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
                      <th className="py-2 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="py-2">{p.item}</td>
                        <td className="py-2">{formatINR(p.amount)}</td>
                        <td className="py-2">{new Date(p.purchase_date).toLocaleDateString()}</td>
                        <td className="py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={async (e) => { e.stopPropagation(); setEditingPurchaseId(p.id); setEditingOpen(true); }} aria-label="Edit purchase">
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
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          No purchases recorded for this customer contact.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

            <PurchaseDialog open={editingOpen} onOpenChange={(open) => { setEditingOpen(open); if (!open) setEditingPurchaseId(null); }} purchaseId={editingPurchaseId} onSaved={() => void fetchContactAndPurchases()} />

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
                  void fetchContactAndPurchases();
                } catch (err) {
                  console.error(err);
                  toast.error("Failed to delete purchase");
                } finally {
                  setPurchaseToDelete(null);
                }
              }}
            />

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Record Purchase</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPurchase} className="grid gap-3">
                <Input placeholder="Item" value={item} onChange={(e) => setItem(e.target.value)} required />
                <Input
                  placeholder="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount === "" ? "" : String(amount)}
                  onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
                <Input
                  placeholder="Quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity === "" ? "" : String(quantity)}
                  onChange={(e) => setQuantity(e.target.value === "" ? "" : Number(e.target.value))}
                  required
                />
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                <div>
                  <Button type="submit">Record Purchase</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="shadow-md border-l-4 border-primary/60 bg-primary/5 mb-4">
            <CardHeader>
              <CardTitle>Total Spend</CardTitle>
            </CardHeader>
            <CardContent>
              {totalsAllowed ? (
                <div className="text-3xl font-bold text-primary">{formatINR(totalSpend)}</div>
              ) : (
                <div className="text-sm text-muted-foreground">You are not authorised to view total spend for this customer contact.</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Customer Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <div className="text-sm text-muted-foreground">Name</div>
                <div className="font-medium">{contact.name}</div>
              </div>
              {contact.email && (
                <div>
                  <div className="text-sm text-muted-foreground">Email</div>
                  <div className="font-medium">{contact.email}</div>
                </div>
              )}
              {contact.phone && (
                <div>
                  <div className="text-sm text-muted-foreground">Phone</div>
                  <div className="font-medium">{contact.phone}</div>
                </div>
              )}
              {contact.address && (
                <div>
                  <div className="text-sm text-muted-foreground">Address</div>
                  <div className="font-medium">{contact.address}</div>
                </div>
              )}
              {isAdmin && (
                <div>
                  <div className="text-sm text-muted-foreground">Assigned To</div>
                  <div className="font-medium">{assignedUserName ?? (contact.assigned_user_id ? contact.assigned_user_id : <span className="text-muted-foreground">—</span>)}</div>
                </div>
              )}
              {canIssueVoucher && (
                <div className="mt-3">
                  <Button onClick={openIssue}>Issue Voucher</Button>
                </div>
              )}
              {/* Total Spend is shown above in a highlighted card and respects role-based access */}
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
              {/* Issue dialog */}
              <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
                <DialogContent className="sm:max-w-md w-full">
                  <DialogHeader>
                    <DialogTitle>Issue Voucher to {contact.name}</DialogTitle>
                  </DialogHeader>

                  <form onSubmit={handleIssueVoucher} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="rule">Voucher Rule</Label>
                      <select id="rule" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedRuleId ?? ""} onChange={(e) => setSelectedRuleId(e.target.value)} required>
                        <option value="">Select a rule</option>
                        {rulesOptions.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={issueLoading}>{issueLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Issue"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ContactProfile;
