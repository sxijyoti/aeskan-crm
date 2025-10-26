import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  assigned_user_id?: string | null;
  created_by?: string | null;
}

interface ContactDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  contact: Contact | null;
}

const ContactDialog = ({ open, onClose, contact }: ContactDialogProps) => {
  const { user, profile, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name,
        email: contact.email || "",
        phone: contact.phone || "",
        address: contact.address || "",
      });
      setAssignedUserId(contact.assigned_user_id || null);
    } else {
      setFormData({
        name: "",
        email: "",
        phone: "",
        address: "",
      });
      setAssignedUserId(user?.id ?? null);
    }
  }, [contact, open, user?.id]);

  useEffect(() => {
    // fetch company users for admin assignment
    const fetchCompanyUsers = async () => {
      if (!profile) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("company_id", profile.company_id)
        .order("full_name", { ascending: true });

      if (error) {
        console.error(error);
      } else {
        setCompanyUsers((data as Array<{ id: string; full_name: string | null }>) || []);
      }
    };

    if (isAdmin) fetchCompanyUsers();
  }, [profile, isAdmin, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    // basic validation
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Enter a valid email address");
      return;
    }
    setLoading(true);

    try {
      if (contact) {
        const updatePayload: Partial<Database["public"]["Tables"]["contacts"]["Update"]> = {
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
        };

        // only admins can change assignment
        if (isAdmin) {
          updatePayload.assigned_user_id = assignedUserId ?? null;
        }

        const { error } = await supabase
          .from("contacts")
          .update(updatePayload)
          .eq("id", contact.id);

        if (error) throw error;
  toast.success("Customer contact updated successfully");
      } else {
        const toInsert: Database["public"]["Tables"]["contacts"]["Insert"] = {
          company_id: profile.company_id,
          created_by: user.id,
          // admins can assign to any company user; regular users only assign to themselves
          assigned_user_id: isAdmin ? assignedUserId ?? user.id : user.id,
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
        };

        const { error } = await supabase.from("contacts").insert(toInsert);

        if (error) throw error;
  toast.success("Customer contact created successfully");
      }

      onClose(true);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(String(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // allow delete for admins or owners/assignees
    if (!contact || !(isAdmin || contact.created_by === user?.id || contact.assigned_user_id === user?.id)) return;
    // deletion is handled via ConfirmDialog (see UI render)
  };

  const handleDeleteConfirmed = async () => {
    if (!contact) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", contact.id);
      if (error) throw error;
      toast.success("Customer contact deleted successfully");
      onClose(true);
    } catch (err: unknown) {
      if (err instanceof Error) toast.error(err.message);
      else toast.error(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit Customer Contact" : "Add New Customer Contact"}</DialogTitle>
          <DialogDescription>
            {contact ? "Update customer contact information" : "Create a new customer contact in your company"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          {isAdmin && (
            <div className="space-y-2">
              <Label htmlFor="assigned">Assigned User</Label>
              <select
                id="assigned"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={assignedUserId ?? ""}
                onChange={(e) => setAssignedUserId(e.target.value || null)}
              >
                <option value="">Unassigned</option>
                {companyUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {contact && (isAdmin || contact.created_by === user?.id || contact.assigned_user_id === user?.id) && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={loading}
                className="sm:mr-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onClose()} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {contact ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={(open) => setConfirmOpen(open)}
          title="Delete customer contact"
          description="Are you sure you want to delete this customer contact? This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDeleteConfirmed}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ContactDialog;
