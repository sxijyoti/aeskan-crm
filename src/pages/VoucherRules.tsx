import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Rule {
  id: string;
  rule_name: string;
  min_spend: number;
  discount_percent: number;
  created_at?: string;
  metadata?: { code?: string } | null;
}

const VoucherRules = () => {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState({ rule_name: "", min_spend: "0", discount_percent: "0", code: "" });

  useEffect(() => {
    fetchRules();
  }, []);

  const formatCurrency = (v?: number | null) =>
    v != null
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(v)
      : "-";

  const fetchRules = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as unknown as any)
        .from("voucher_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRules((data || []) as Rule[]);
    } catch (err: unknown) {
      console.warn(err);
      toast.error("Failed to load voucher rules");
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (r?: Rule) => {
    if (r) {
      setEditing(r);
      setForm({ rule_name: r.rule_name, min_spend: String(r.min_spend), discount_percent: String(r.discount_percent), code: (r.metadata as any)?.code || "" });
    } else {
      setEditing(null);
      setForm({ rule_name: "", min_spend: "0", discount_percent: "0", code: "" });
    }
  };

  const validate = () => {
    if (!form.rule_name.trim()) {
      toast.error("Rule name is required");
      return false;
    }
    const min = Number(form.min_spend);
    const pct = Number(form.discount_percent);
    if (Number.isNaN(min) || min < 0) {
      toast.error("Min spend must be >= 0");
      return false;
    }
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Discount must be between 0 and 100");
      return false;
    }
    return true;
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        rule_name: form.rule_name.trim(),
        min_spend: Number(form.min_spend),
        discount_percent: Number(form.discount_percent),
        metadata: form.code ? { code: form.code } : null,
      };

      if (editing) {
        const { error } = await (supabase as unknown as any).from("voucher_rules").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Rule updated");
      } else {
        const { error } = await (supabase as unknown as any).from("voucher_rules").insert([payload]);
        if (error) throw error;
        toast.success("Rule created");
      }

      startEdit(undefined);
      fetchRules();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to save rule");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    try {
      const { error } = await (supabase as unknown as any).from("voucher_rules").delete().eq("id", id);
      if (error) throw error;
      toast.success("Rule deleted");
      fetchRules();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to delete rule");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Voucher Rules (Admin)</h2>
      </div>

      

      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Edit Rule" : "Add Rule"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Rule name</Label>
              <Input value={form.rule_name} onChange={(e) => setForm({ ...form, rule_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Code (optional)</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WELCOME10" />
            </div>
            <div className="space-y-2">
              <Label>Min spend</Label>
              <Input type="number" value={form.min_spend} onChange={(e) => setForm({ ...form, min_spend: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Discount %</Label>
              <Input type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
            </div>

            <div className="md:col-span-3 flex gap-2 justify-end">
              {editing && (
                <Button variant="ghost" type="button" onClick={() => startEdit(undefined)}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (editing ? "Updating..." : "Creating...") : editing ? "Update Rule" : "Create Rule"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading...</p>
          ) : rules.length === 0 ? (
            <p className="text-muted-foreground">No voucher rules yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="text-sm text-muted-foreground text-left">
                    <th className="py-2">Rule</th>
                    <th className="py-2">Code</th>
                    <th className="py-2">Min spend</th>
                    <th className="py-2 text-right">Discount %</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-3 font-medium">{r.rule_name}</td>
                      <td className="py-3">{(r.metadata as any)?.code || '-'}</td>
                      <td className="py-3">{formatCurrency(r.min_spend)}</td>
                      <td className="py-3 text-right">{Number(r.discount_percent).toFixed(2)}%</td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(r)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                            Delete
                          </Button>
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
    </div>
  );
};

export default VoucherRules;
