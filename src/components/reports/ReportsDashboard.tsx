import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users, ShoppingCart, Coins, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Stats {
  totalContacts: number;
  totalPurchases: number;
  totalRevenue: number;
}

const ReportsDashboard = () => {
  const { profile, user, isAdmin } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalContacts: 0,
    totalPurchases: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState<Array<{ id: string; name: string; contacts: number; purchases: number; revenue: number }>>([]);
  const [contactsList, setContactsList] = useState<Array<{ id: string; name: string; created_by?: string | null; assigned_user_id?: string | null }>>([]);
  const [purchasesList, setPurchasesList] = useState<Array<{ id: string; amount?: number | string; contacts?: { id?: string; created_by?: string | null; assigned_user_id?: string | null; name?: string } | null; item?: string; purchase_date?: string }>>([]);
  const [profilesList, setProfilesList] = useState<Array<{ id: string; full_name?: string | null }>>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!profile) return;

      setLoading(true);

      try {
        // Fetch company-wide contacts and purchases (with contact info)
        const [contactsRes, purchasesRes, profilesRes] = await Promise.all([
          // include name on contacts so UI lists/types have it
          supabase.from("contacts").select("id, name, created_by, assigned_user_id").eq("company_id", profile.company_id),
          // include nested contact name for purchases
          supabase.from("purchases").select("id, amount, item, purchase_date, contacts(id, name, created_by, assigned_user_id)").eq("company_id", profile.company_id),
          supabase.from("profiles").select("id, full_name").eq("company_id", profile.company_id),
        ]);

        if (contactsRes.error) throw contactsRes.error;
        if (purchasesRes.error) throw purchasesRes.error;
        if (profilesRes.error) throw profilesRes.error;

  const contacts = (contactsRes.data as Array<{ id: string; name?: string | null; created_by?: string | null; assigned_user_id?: string | null }>) || [];
  const purchases = (purchasesRes.data as Array<{ id: string; amount?: number | string; item?: string | null; purchase_date?: string | null; contacts?: { id?: string; name?: string | null; created_by?: string | null; assigned_user_id?: string | null } | null }>) || [];
        const profiles = (profilesRes.data as Array<{ id: string; full_name?: string | null }>) || [];

        // fetch roles for the fetched profiles to exclude admin accounts from per-user stats
        const profileIds = profiles.map((p) => p.id);
        let adminIds = new Set<string>();
        if (profileIds.length > 0) {
          try {
            const { data: rolesData, error: rolesErr } = await supabase
              .from("user_roles")
              .select("user_id, role")
              .in("user_id", profileIds)
              .eq("role", "admin");
            if (!rolesErr && rolesData) {
              (rolesData as Array<{ user_id: string; role: string }>).forEach((r) => {
                if (r.role === "admin") adminIds.add(r.user_id);
              });
            }
          } catch (err) {
            console.error("Failed to load user roles for reports", err);
          }
        }

        // Company totals
        const totalContacts = contacts.length;
        const totalPurchases = purchases.length;
        const totalRevenue = purchases.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

        setStats({ totalContacts, totalPurchases, totalRevenue });

        // Build per-user stats
        // exclude admin profiles from per-user reporting
        const visibleProfiles = profiles.filter((prof) => !adminIds.has(prof.id));
        const perUser = visibleProfiles.map((prof) => {
          const userContacts = contacts.filter((c) => c.created_by === prof.id || c.assigned_user_id === prof.id);
          const userPurchases = purchases.filter((p) => p.contacts && (p.contacts.created_by === prof.id || p.contacts.assigned_user_id === prof.id));
          const revenue = userPurchases.reduce((s, p) => s + Number(p.amount ?? 0), 0);
          return { id: prof.id, name: prof.full_name || "(no name)", contacts: userContacts.length, purchases: userPurchases.length, revenue };
        });

  setUserStats(perUser.sort((a, b) => b.revenue - a.revenue));
  // expose only non-admin profiles in the profiles list used for per-user drilldowns
  setProfilesList(visibleProfiles.map((p) => ({ id: p.id, full_name: p.full_name })) as Array<{ id: string; full_name?: string | null }>);
  // ensure every contact has a name (avoid TypeScript required-name mismatch)
  setContactsList(contacts.map((c) => ({ ...c, name: c.name ?? "(no name)" })));
  setPurchasesList(purchases);

        // If not admin, scope the displayed stats to the current user
        if (!isAdmin && user) {
          const meContacts = contacts.filter((c) => c.created_by === user.id || c.assigned_user_id === user.id).length;
          const mePurchases = purchases.filter((p) => p.contacts && (p.contacts.created_by === user.id || p.contacts.assigned_user_id === user.id)).length;
          const meRevenue = purchases.filter((p) => p.contacts && (p.contacts.created_by === user.id || p.contacts.assigned_user_id === user.id)).reduce((s, p) => s + Number(p.amount ?? 0), 0);

          setStats({ totalContacts: meContacts, totalPurchases: mePurchases, totalRevenue: meRevenue });
        }
      } catch (error: unknown) {
        toast.error("Failed to load statistics");
        if (error instanceof Error) console.error(error);
        else console.error(String(error));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Customer Contacts</CardTitle>
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalContacts}</div>
          <p className="text-xs text-muted-foreground mt-1">All company customer contacts</p>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
          <div className="p-2 bg-accent/10 rounded-lg">
            <ShoppingCart className="h-4 w-4 text-accent" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalPurchases}</div>
          <p className="text-xs text-muted-foreground mt-1">Total transactions</p>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <div className="p-2 bg-success/10 rounded-lg">
            <Coins className="h-4 w-4 text-success" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatINR(stats.totalRevenue)}</div>
          <p className="text-xs text-muted-foreground mt-1">Lifetime revenue</p>
        </CardContent>
      </Card>
      </div>

      {/* If admin, show per-user breakdown */}
      {isAdmin ? (
        <div className="bg-card p-4 rounded-md shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Per-user performance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="text-sm text-muted-foreground">
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-left">Customer Contacts</th>
                  <th className="px-4 py-2 text-left">Purchases</th>
                  <th className="px-4 py-2 text-left">Revenue</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {userStats.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/5">
                    <td className="px-4 py-2">{u.name}</td>
                    <td className="px-4 py-2">{u.contacts}</td>
                    <td className="px-4 py-2">{u.purchases}</td>
                    <td className="px-4 py-2">{formatINR(u.revenue)}</td>
                    <td className="px-4 py-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedUser(u.id)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* User modal */}
          <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
            <DialogContent className="sm:max-w-3xl w-full">
              <DialogHeader>
                <DialogTitle>User performance</DialogTitle>
              </DialogHeader>
              {selectedUser ? (
                (() => {
                  const prof = profilesList.find((p) => p.id === selectedUser);
                  const userContacts = contactsList.filter((c) => c.created_by === selectedUser || c.assigned_user_id === selectedUser);
                  const userPurchases = purchasesList.filter((p) => p.contacts && (p.contacts.created_by === selectedUser || p.contacts.assigned_user_id === selectedUser));
                  const revenue = userPurchases.reduce((s, p) => s + Number(p.amount ?? 0), 0);

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-muted-foreground">User</div>
                          <div className="font-medium">{prof?.full_name ?? "(no name)"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Revenue</div>
                          <div className="font-bold">{formatINR(revenue)}</div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold">Customer Contacts ({userContacts.length})</h4>
                        <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground">
                          {userContacts.slice(0, 20).map((c) => (
                            <li key={c.id}>{c.name}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold">Recent purchases ({userPurchases.length})</h4>
                        <div className="overflow-x-auto mt-2">
                          <table className="min-w-full">
                            <thead>
                              <tr className="text-sm text-muted-foreground">
                                <th className="px-3 py-2 text-left">Item</th>
                                <th className="px-3 py-2 text-left">Amount</th>
                                <th className="px-3 py-2 text-left">Date</th>
                              </tr>
                            </thead>
                            <tbody>
                              {userPurchases.slice(0, 50).map((p) => (
                                <tr key={p.id} className="border-t">
                                  <td className="px-3 py-2">{p.item}</td>
                                  <td className="px-3 py-2">{formatINR(Number(p.amount ?? 0))}</td>
                                  <td className="px-3 py-2">{p.purchase_date ? new Date(p.purchase_date).toLocaleDateString() : "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-card p-4 rounded-md shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Your Customer Contacts</h3>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {contactsList.filter((c) => c.created_by === (user?.id) || c.assigned_user_id === (user?.id)).map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
          </div>

          <div className="bg-card p-4 rounded-md shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Recent Purchases</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-sm text-muted-foreground">
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-left">Amount</th>
                    <th className="px-3 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {purchasesList.filter((p) => p.contacts && (p.contacts.created_by === user?.id || p.contacts.assigned_user_id === user?.id)).slice(0, 50).map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2">{p.item}</td>
                      <td className="px-3 py-2">{formatINR(Number(p.amount ?? 0))}</td>
                      <td className="px-3 py-2">{p.purchase_date ? new Date(p.purchase_date).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsDashboard;
