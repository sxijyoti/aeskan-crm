import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

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
  item?: string;
  description?: string;
  date?: string; // purchase date field (date)
  created_at?: string; // timestamptz when the row was created
}

interface Voucher {
  id: string;
  contact_id?: string;
  rule_id?: string;
  issued_at?: string;
  status?: string;
  metadata?: { code?: string } | null;
  rule_name?: string | null;
}

const ContactProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [totalSpend, setTotalSpend] = useState<number | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const [editStatus, setEditStatus] = useState<string>("issued");
  const [editIssuedAt, setEditIssuedAt] = useState<string>("");
  const [editRuleId, setEditRuleId] = useState<string | undefined>(undefined);
  const [rulesList, setRulesList] = useState<Array<{ id: string; rule_name: string; metadata?: any }>>([]);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertVoucher, setAlertVoucher] = useState<Voucher | null>(null);
  const [alertAction, setAlertAction] = useState<"delete" | "redeem" | null>(null);
  // admin-only issue voucher from profile
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueRuleId, setIssueRuleId] = useState<string | undefined>(undefined);
  const [issueCode, setIssueCode] = useState("");
  const [isIssuing, setIsIssuing] = useState(false);

  const formatCurrency = (v?: number | null) =>
    v != null
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v)
      : "-";

  const formatDate = (d?: string | null) => {
    if (!d) return "-";
    try {
      // prefer date-only values, but handle ISO timestamps too
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString("en-IN");
    } catch (err) {
      return String(d);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchContact(id);
    fetchPurchases(id);
    fetchTotalSpend(id);
    fetchVouchers(id);
  }, [id]);

  const { userRole } = useAuth();

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

  const fetchVouchers = async (contactId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as unknown as any)
        .from("vouchers")
        .select("*")
        .eq("contact_id", contactId)
        .order("issued_at", { ascending: false });

      if (error) {
        console.warn("Could not load vouchers: ", error);
        setVouchers([]);
        return;
      }

      const rows = (data || []) as any[];

      // Collect rule ids and fetch rule names in a single query for display
      const ruleIds = Array.from(new Set(rows.map((r) => r.rule_id).filter(Boolean)));
      let ruleMap: Record<string, { rule_name?: string; metadata?: any }> = {};
      if (ruleIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rulesData, error: rulesError } = await (supabase as unknown as any)
          .from("voucher_rules")
          .select("id, rule_name, metadata")
          .in("id", ruleIds);
        if (!rulesError && Array.isArray(rulesData)) {
          ruleMap = (rulesData as any[]).reduce((acc, r) => {
            acc[r.id] = { rule_name: r.rule_name, metadata: r.metadata };
            return acc;
          }, {} as Record<string, any>);
        }
      }

      const mapped: Voucher[] = rows.map((r) => ({
        id: r.id,
        contact_id: r.contact_id,
        rule_id: r.rule_id,
        issued_at: r.issued_at || r.created_at,
        status: r.status,
        metadata: r.metadata,
        rule_name: r.rule_id ? ruleMap[r.rule_id]?.rule_name : null,
      }));

      setVouchers(mapped);
    } catch (err) {
      console.warn(err);
      setVouchers([]);
    }
  };

  const handleDeleteVoucher = async (voucherId?: string) => {
    if (!voucherId) return setAlertOpen(false);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as unknown as any).from("vouchers").delete().eq("id", voucherId);
      if (error) throw error;
      toast.success("Voucher deleted");
      setAlertOpen(false);
      if (id) fetchVouchers(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to delete voucher");
    }
  };

  const handleRedeemVoucher = async (voucherId?: string) => {
    if (!voucherId) return setAlertOpen(false);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as unknown as any).from("vouchers").update({ status: "redeemed" }).eq("id", voucherId);
      if (error) throw error;
      toast.success("Voucher marked redeemed");
      setAlertOpen(false);
      if (id) fetchVouchers(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to redeem voucher");
    }
  };

  const openEditDialog = (voucher: Voucher) => {
    setEditingVoucher(voucher);
    setEditCode(voucher.metadata?.code || "");
    setEditStatus(voucher.status || "issued");
    setEditRuleId(voucher.rule_id || undefined);
    // normalize issued_at to datetime-local value or empty
    try {
      const dt = voucher.issued_at ? new Date(voucher.issued_at) : new Date();
      // datetime-local expects yyyy-mm-ddThh:MM
      setEditIssuedAt(new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
    } catch (err) {
      setEditIssuedAt("");
    }
    setEditOpen(true);
  };

  const saveEditDialog = async () => {
    if (!editingVoucher) return setEditOpen(false);
    try {
      const payload: any = {
        metadata: editCode ? { code: editCode } : null,
        status: editStatus,
      };
      if (editRuleId) payload.rule_id = editRuleId;
      if (editIssuedAt) {
        // convert local datetime-local value to ISO
        const iso = new Date(editIssuedAt).toISOString();
        payload.issued_at = iso;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as unknown as any)
        .from("vouchers")
        .update(payload)
        .eq("id", editingVoucher.id);
      if (error) throw error;
      toast.success("Voucher updated");
      setEditOpen(false);
      if (id) fetchVouchers(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to update voucher");
    }
  };

  const handleIssueFromProfile = async () => {
    if (!id) return toast.error("Missing contact id");
    if (!issueRuleId) return toast.error("Please select a voucher rule");
    setIsIssuing(true);
    try {
      const payload: any = {
        contact_id: id,
        rule_id: issueRuleId,
        status: "issued",
        metadata: issueCode ? { code: issueCode } : null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as unknown as any).from("vouchers").insert([payload]);
      if (error) throw error;
      toast.success("Voucher Issued Successfully");
      setIssueOpen(false);
      setIssueRuleId(undefined);
      setIssueCode("");
      fetchVouchers(id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to issue voucher");
    } finally {
      setIsIssuing(false);
    }
  };

  const fetchVoucherRules = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as unknown as any).from("voucher_rules").select("id, rule_name, metadata").order("created_at", { ascending: false });
      if (error) throw error;
      setRulesList((data || []) as any);
    } catch (err) {
      console.warn("Failed to load voucher rules for edit dialog", err);
    }
  };

  // load voucher rules for the edit dialog
  useEffect(() => {
    fetchVoucherRules();
  }, []);

  // when rule is selected in issue dialog, prefill code if available
  useEffect(() => {
    if (!issueRuleId) return setIssueCode("");
    const r = rulesList.find((x) => x.id === issueRuleId);
    setIssueCode((r && (r.metadata as any)?.code) || "");
  }, [issueRuleId, rulesList]);

  const fetchTotalSpend = async (contactId: string) => {
    try {
      // aggregate sum(amount) for this contact
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as unknown as any)
        .from("purchases")
        .select("sum(amount)")
        .eq("contact_id", contactId);

      if (error) {
        // table might not exist or the aggregate failed — don't overwrite local total
        console.warn("Could not fetch total spend:", error);
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
      if (Number.isFinite(value)) {
        setTotalSpend(value);
      }
    } catch (err) {
      console.warn(err);
      // don't overwrite local total on unexpected errors
      return;
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
        <div className="flex items-center gap-2">
          {userRole === "admin" && (
            <Button onClick={() => setIssueOpen(true)}>+ Issue Voucher</Button>
          )}
          <Button onClick={() => navigate(-1)}>Back</Button>
        </div>
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
                  <span className="text-primary">{formatCurrency(totalSpend)}</span>
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
                      <td className="py-3">{p.item || p.description || "Purchase"}</td>
                      <td className="py-3 text-sm text-muted-foreground">{formatDate(p.date ?? p.created_at)}</td>
                      <td className="py-3 text-right font-semibold">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issued Vouchers</CardTitle>
        </CardHeader>
        <CardContent>
          {vouchers.length === 0 ? (
            <p className="text-muted-foreground">No vouchers issued to this contact.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="text-sm text-muted-foreground text-left">
                    <th className="py-2">Code</th>
                    <th className="py-2">Rule</th>
                    <th className="py-2">Issued</th>
                    <th className="py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="py-3">{v.metadata?.code || "-"}</td>
                      <td className="py-3 font-medium">{v.rule_name || "-"}</td>
                      <td className="py-3 text-sm text-muted-foreground">{formatDate(v.issued_at)}</td>
                      <td className="py-3 text-right font-semibold">{v.status || "-"}</td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {userRole === "admin" && (
                            <Button size="sm" variant="ghost" onClick={() => openEditDialog(v)}>
                              Edit
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { setAlertVoucher(v); setAlertAction('redeem'); setAlertOpen(true); }}>
                            Redeem
                          </Button>
                          {userRole === "admin" && (
                            <Button size="sm" variant="ghost" onClick={() => { setAlertVoucher(v); setAlertAction('delete'); setAlertOpen(true); }}>
                              Delete
                            </Button>
                          )}
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
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Voucher Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Code</Label>
            <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} />
          </div>
          <DialogFooter>
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveEditDialog}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Alert for Redeem/Delete */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {alertAction === "delete" ? "Delete voucher?" : "Redeem voucher?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alertAction === "delete"
                ? "This will permanently delete the voucher. This action cannot be undone."
                : "Mark this voucher as redeemed?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel asChild>
              <Button variant="outline">Cancel</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={() => {
                  if (!alertVoucher) return setAlertOpen(false);
                  if (alertAction === "delete") handleDeleteVoucher(alertVoucher.id);
                  else if (alertAction === "redeem") handleRedeemVoucher(alertVoucher.id);
                }}
              >
                {alertAction === "delete" ? "Delete" : "Confirm"}
              </Button>
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      {/* Issue Voucher Dialog (admin only) */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Voucher</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Voucher Rule</Label>
              <Select value={issueRuleId} onValueChange={(v) => setIssueRuleId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rule" />
                </SelectTrigger>
                <SelectContent>
                  {rulesList.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.rule_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Code (optional)</Label>
              <Input value={issueCode} onChange={(e) => setIssueCode(e.target.value)} placeholder="e.g. WELCOME10" />
            </div>
          </div>
          <DialogFooter>
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={() => setIssueOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleIssueFromProfile} disabled={isIssuing}>
                {isIssuing ? "Issuing..." : "Issue Voucher"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactProfile;
