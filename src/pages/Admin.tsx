import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const Admin = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Array<{ id: string; name?: string; email?: string }>>([]);
  const [rules, setRules] = useState<Array<{ id: string; rule_name: string; metadata?: { code?: string } | null }>>([]);
  const [selectedContact, setSelectedContact] = useState<string | undefined>(undefined);
  const [selectedRule, setSelectedRule] = useState<string | undefined>(undefined);
  const [code, setCode] = useState<string>("");
  const [isIssuing, setIsIssuing] = useState(false);

  useEffect(() => {
    fetchContacts();
    fetchRules();
  }, []);

  const fetchContacts = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as unknown as any)
        .from("contacts")
        .select("id, name, email")
        .order("name", { ascending: true });
      if (error) throw error;
      setContacts((data || []) as any);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load contacts");
    }
  };

  const fetchRules = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as unknown as any)
        .from("voucher_rules")
        .select("id, rule_name, metadata")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRules((data || []) as any);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load voucher rules");
    }
  };

  // when the selectedRule changes, prefill the code from the rule metadata (if available)
  useEffect(() => {
    if (!selectedRule) {
      setCode("");
      return;
    }
    const r = rules.find((x) => x.id === selectedRule);
    setCode((r && (r.metadata as any)?.code) || "");
  }, [selectedRule, rules]);

  const handleIssue = async () => {
    if (!selectedContact) return toast.error("Please select a customer");
    if (!selectedRule) return toast.error("Please select a voucher rule");
    setIsIssuing(true);
    try {
      const payload = {
        contact_id: selectedContact,
        rule_id: selectedRule,
        status: "issued",
        metadata: code ? { code } : null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as unknown as any).from("vouchers").insert([payload]);
      if (error) throw error;
      toast.success("Voucher Issued Successfully");
      // clear selections
      setSelectedContact(undefined);
      setSelectedRule(undefined);
      setCode("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message || "Failed to issue voucher");
    } finally {
      setIsIssuing(false);
    }
  };
  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Admin Dashboard</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Admin features and controls will be implemented here. Admins can view all contacts and manage users.
          </p>
          <div className="mt-4">
            <Button onClick={() => navigate('/admin/voucher-rules')}>Voucher Rules</Button>
          </div>
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Issue Voucher</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div>
                    <Label>Customer</Label>
                    <Select value={selectedContact} onValueChange={(v) => setSelectedContact(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name || c.email || c.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Voucher Rule</Label>
                    <Select value={selectedRule} onValueChange={(v) => setSelectedRule(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select rule" />
                      </SelectTrigger>
                      <SelectContent>
                        {rules.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.rule_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Code (optional)</Label>
                    <input
                      className="input h-10 w-full rounded-md border px-3 py-2 text-sm"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. WELCOME10"
                    />
                  </div>

                  <div className="md:col-span-1">
                    <Button onClick={handleIssue} disabled={isIssuing}>
                      {isIssuing ? "Issuing..." : "Issue Voucher"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;
