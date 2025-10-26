import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  role?: string | null;
};

const CompanyUsers = () => {
  const { profile, isAdmin } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("company_id", profile.company_id)
        .order("full_name", { ascending: true });

      if (error) throw error;

      const rows = (profiles || []) as Array<{ id: string; full_name: string | null; email: string }>;

      // fetch roles for each user
      const withRoles = await Promise.all(
        rows.map(async (r) => {
          const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", r.id).single();
          return { id: r.id, full_name: r.full_name, email: r.email, role: roleData?.role ?? null } as ProfileRow;
        }),
      );

      // hide admin profiles from the company users listing per request
      setUsers(withRoles.filter((u) => u.role !== "admin"));
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to load company users");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const promote = async (userId: string) => {
    try {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) throw error;
      toast.success("User promoted to admin");
      void fetchUsers();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to promote user");
    }
  };

  const demote = async (userId: string) => {
    try {
      const { error } = await supabase.from("user_roles").delete().match({ user_id: userId, role: "admin" });
      if (error) throw error;
      toast.success("User demoted from admin");
      void fetchUsers();
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to demote user");
    }
  };

  if (!profile) return null;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-primary rounded-2xl">
            <Users className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle>Company Users</CardTitle>
            <div className="text-sm text-muted-foreground">Manage user access and roles for your company</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Role</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="py-2">{u.full_name ?? "—"}</td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{u.role === "admin" ? "Admin" : "User"}</td>
                    <td className="py-2">
                      {isAdmin && (
                        <div className="flex gap-2">
                          {u.role === "admin" ? (
                            <Button variant="outline" size="sm" onClick={() => demote(u.id)}>
                              Demote
                            </Button>
                          ) : (
                            <Button size="sm" onClick={() => promote(u.id)}>
                              Promote
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyUsers;
