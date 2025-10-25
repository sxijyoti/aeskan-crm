import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Plus, Edit2, Trash2 } from "lucide-react";
import { DialogTrigger } from "@/components/ui/dialog";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

type VoucherRuleRow = Database["public"]["Tables"]["voucher_rules"]["Row"];


const VoucherRulesList = () => {
  const { profile, isAdmin, user } = useAuth();
  const [rules, setRules] = useState<VoucherRuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherRuleRow | null>(null);
  const [form, setForm] = useState<Partial<VoucherRuleRow>>({
    name: "",
    description: "",
    discount_type: "percentage",
    discount_value: 0,
    min_purchase_amount: 0,
    max_discount_amount: null,
    is_active: true,
  });

  const fetchRules = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("voucher_rules")
        .select("*")
        .eq("company_id", profile.company_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRules((data as VoucherRuleRow[]) || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load voucher rules");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      discount_type: "percentage",
      discount_value: 0,
      min_purchase_amount: 0,
      max_discount_amount: null,
      is_active: true,
    });
    setOpen(true);
  };

  const openEdit = (r: VoucherRuleRow) => {
    setEditing(r);
    setForm(r);
    setOpen(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!profile || !user) return;
    if (!form.name || form.name.trim() === "") {
      toast.error("Name is required");
      return;
    }
    setLoading(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("voucher_rules")
          .update({
            name: form.name,
            description: form.description ?? null,
            discount_type: form.discount_type ?? "percentage",
            discount_value: Number(form.discount_value) || 0,
            min_purchase_amount: form.min_purchase_amount ?? null,
            max_discount_amount: form.max_discount_amount ?? null,
            is_active: form.is_active ?? true,
          } as Partial<VoucherRuleRow>)
          .eq("id", editing.id);

        if (error) throw error;
        toast.success("Voucher rule updated");
      } else {
        const toInsert: Database["public"]["Tables"]["voucher_rules"]["Insert"] = {
          company_id: profile.company_id,
          name: String(form.name),
          description: form.description ?? null,
          discount_type: (form.discount_type as string) ?? "percentage",
          discount_value: Number(form.discount_value) || 0,
          min_purchase_amount: form.min_purchase_amount ?? null,
          max_discount_amount: form.max_discount_amount ?? null,
          is_active: form.is_active ?? true,
        };

        const { error } = await supabase.from("voucher_rules").insert(toInsert);
        if (error) throw error;
        toast.success("Voucher rule created");
      }

      setOpen(false);
      void fetchRules();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to save voucher rule");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this voucher rule?")) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("voucher_rules").delete().eq("id", id);
      if (error) throw error;
      toast.success("Voucher rule deleted");
      void fetchRules();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete voucher rule");
    } finally {
      setLoading(false);
    }
  };

  // Issue voucher flow
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueRule, setIssueRule] = useState<VoucherRuleRow | null>(null);
  const [contactsOptions, setContactsOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  const canIssue = Boolean(profile && user);

  // fetch contacts options up front for the Issue Vouchers section
  useEffect(() => {
    if (!profile) return;
    const fetchContacts = async () => {
      try {
        let query = supabase.from("contacts").select("id, name").eq("company_id", profile.company_id).limit(200);
        if (!isAdmin && user) {
          query = supabase
            .from("contacts")
            .select("id, name")
            .eq("company_id", profile.company_id)
            .or(`created_by.eq.${user.id},assigned_user_id.eq.${user.id}`)
            .limit(200);
        }
        const { data, error } = await query;
        if (error) throw error;
        setContactsOptions((data as Array<{ id: string; name: string }>) || []);
      } catch (err) {
        console.error(err);
        setContactsOptions([]);
      }
    };
    void fetchContacts();
  }, [profile, isAdmin, user]);

  // recent vouchers list
  const [vouchersList, setVouchersList] = useState<Array<{ id: string; code: string; status: string; issued_at?: string | null; contact?: { id: string; name?: string } | null; voucher_rule?: { name?: string } | null }>>([]);
  const fetchVouchers = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select("id, code, status, issued_at, contacts(id, name), voucher_rules(name)")
        .eq("company_id", profile.company_id)
        .order("issued_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setVouchersList((data as any) || []);
    } catch (err) {
      console.error(err);
      setVouchersList([]);
    }
  };

  useEffect(() => {
    void fetchVouchers();
  }, [profile]);

  // sync selectedRuleId -> issueRule object
  useEffect(() => {
    if (!selectedRuleId) {
      setIssueRule(null);
      return;
    }
    const found = rules.find((r) => r.id === selectedRuleId) || null;
    setIssueRule(found);
  }, [selectedRuleId, rules]);

  const openIssue = async (rule: VoucherRuleRow) => {
  setIssueRule(rule);
  setIssueOpen(true);
  setSelectedContact(null);
    try {
      // admins can pick any contact; users only their contacts (assigned or created)
      let query = supabase.from("contacts").select("id, name").eq("company_id", profile!.company_id).limit(200);
      if (!isAdmin && user) {
        query = supabase
          .from("contacts")
          .select("id, name")
          .eq("company_id", profile!.company_id)
          .or(`created_by.eq.${user.id},assigned_user_id.eq.${user.id}`)
          .limit(200);
      }
      const { data, error } = await query;
      if (error) throw error;
      setContactsOptions((data as Array<{ id: string; name: string }>) || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load contacts for voucher issuance");
      setContactsOptions([]);
    }
  };

  const handleIssue = async (e?: React.FormEvent) => {
    e?.preventDefault();
      if (!issueRule || !profile || !user || !selectedContact) return;
    setIssueLoading(true);
    try {
      const code = `V-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
      const toInsert = [{
        code,
        company_id: profile.company_id,
        contact_id: selectedContact,
        issued_by: user.id,
        voucher_rule_id: issueRule.id,
        status: "issued",
      } as Database["public"]["Tables"]["vouchers"]["Insert"]];

      const { error } = await supabase.from("vouchers").insert(toInsert);
      if (error) throw error;
      toast.success("Voucher issued");
      setIssueOpen(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to issue voucher");
    } finally {
      setIssueLoading(false);
    }
  };

  

  if (!profile) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Voucher Rules</CardTitle>
            <div className="text-sm text-muted-foreground">Create rules that generate vouchers for customers</div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> New Rule
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
  <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : isAdmin ? (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="py-2">Name</th>
                  <th className="py-2">Min Spend</th>
                  <th className="py-2">Discount</th>
                  <th className="py-2">Active</th>
                  <th className="py-2 text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/5">
                    <td className="py-2">{r.name}</td>
                    <td className="py-2">{r.min_purchase_amount ? formatINR(Number(r.min_purchase_amount)) : "—"}</td>
                    <td className="py-2">{r.discount_type === "percentage" ? `${r.discount_value}%` : formatINR(Number(r.discount_value))}</td>
                    <td className="py-2">{r.is_active ? "Yes" : "No"}</td>
                    <td className="py-2 text-right align-middle">
                      <div className="inline-flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 flex items-center justify-center" onClick={() => openEdit(r as VoucherRuleRow)} aria-label={`Edit ${r.name}`}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" className="h-8 w-8 p-0 flex items-center justify-center" onClick={() => handleDelete(r.id)} aria-label={`Delete ${r.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">No voucher rules found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          // non-admins can view rules and issue vouchers to their contacts
          <div>
            <div className="grid gap-3">
              {rules.map((r) => (
                <div key={r.id} className="p-3 bg-card rounded-md flex items-center justify-between">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-sm text-muted-foreground">{r.discount_type === "percentage" ? `${r.discount_value}%` : formatINR(Number(r.discount_value))}</div>
                  </div>
                </div>
              ))}
              {rules.length === 0 && <div className="text-center text-muted-foreground">No voucher rules available</div>}
            </div>
          </div>
        )}
      </CardContent>

      {/* Separate Issue Vouchers section */}
      {canIssue && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Issue Vouchers</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIssue} className="flex flex-col md:flex-row gap-3 items-start md:items-end">
              <div className="flex-1">
                <Label htmlFor="rule">Voucher Rule</Label>
                <select id="rule" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedRuleId ?? ""} onChange={(e) => setSelectedRuleId(e.target.value)} required>
                  <option value="">Select a rule</option>
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <Label htmlFor="contacts">Contacts</Label>
                <select id="contacts" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-10" value={selectedContact ?? ""} onChange={(e) => setSelectedContact(e.target.value)}>
                  <option value="">Select a contact</option>
                  {contactsOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-shrink-0">
                <Button className="h-10" type="submit" disabled={issueLoading || !selectedContact || !issueRule}>{issueLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Issue Voucher"}</Button>
              </div>
            </form>

            {/* recent vouchers table */}
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Recent Vouchers</h4>
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="text-left text-sm text-muted-foreground">
                      <th className="py-2">Code</th>
                      <th className="py-2">Rule</th>
                      <th className="py-2">Contact</th>
                      <th className="py-2">Issued At</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchersList.map((v) => (
                      <tr key={v.id} className="border-t hover:bg-muted/5">
                        <td className="py-2 font-mono">{v.code}</td>
                        <td className="py-2">{v.voucher_rule?.name ?? "—"}</td>
                        <td className="py-2">{v.contact?.name ?? "—"}</td>
                        <td className="py-2">{v.issued_at ? new Date(v.issued_at).toLocaleString() : "-"}</td>
                        <td className="py-2">{v.status}</td>
                      </tr>
                    ))}
                    {vouchersList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">No vouchers yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg w-full">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Voucher Rule" : "New Voucher Rule"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min">Min Spend (optional)</Label>
              <Input
                id="min"
                type="number"
                step="0.01"
                value={form.min_purchase_amount ?? ""}
                onChange={(e) => setForm({ ...form, min_purchase_amount: e.target.value ? Number(e.target.value) : null })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discount">Discount Value</Label>
              <Input
                id="discount"
                type="number"
                step="0.01"
                value={form.discount_value ?? 0}
                onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Discount Type</Label>
              <select
                id="type"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.discount_type ?? "percentage"}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* issue dialog removed — inline Issue Vouchers section is used instead */}
    </Card>
  );
};

export default VoucherRulesList;

