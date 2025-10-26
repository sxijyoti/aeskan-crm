import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ContactDialog from "./ContactDialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  assigned_user_id?: string | null;
  created_by?: string | null;
  profiles?: {
    full_name: string | null;
  };
  // populated only for admin view
  assigned_user_name?: string | null;
}

const ContactsList = () => {
  const { profile, isAdmin, user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);

  const fetchContacts = useCallback(async (term?: string) => {
    if (!profile) return;
    setLoading(true);

    try {
      let query = supabase.from("contacts").select("*").eq("company_id", profile.company_id);

      if (term && term.trim()) {
        const t = term.trim();
        query = query.or(`name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        toast.error("Failed to load customer contacts");
        console.error(error);
        setContacts([]);
      } else {
        const rows = (data as Contact[]) || [];

        // keep access rules (users still see contacts they created or are assigned to)
        const visible: Contact[] = isAdmin
          ? rows
          : rows.filter((c) => c.created_by === user?.id || c.assigned_user_id === user?.id);

        // if admin, fetch assigned user names to show in the table
        if (isAdmin && visible.length > 0) {
          try {
            const assignedIds = Array.from(new Set(visible.map((c) => c.assigned_user_id).filter(Boolean) as string[]));
            if (assignedIds.length > 0) {
              const { data: usersData, error: usersErr } = await supabase.from("profiles").select("id, full_name").in("id", assignedIds);
              if (!usersErr && usersData) {
                const map = (usersData as Array<{ id: string; full_name: string | null }>).reduce<Record<string, string>>((acc, u) => {
                  acc[u.id] = u.full_name ?? "";
                  return acc;
                }, {});
                const withNames = visible.map((c) => ({ ...c, assigned_user_name: c.assigned_user_id ? map[c.assigned_user_id] ?? null : null }));
                setContacts(withNames);
              } else {
                setContacts(visible);
              }
            } else {
              setContacts(visible);
            }
          } catch (err) {
            console.error(err);
            setContacts(visible);
          }
        } else {
          setContacts(visible);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [profile, isAdmin, user?.id]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => void fetchContacts(searchTerm), 300);
    return () => clearTimeout(id);
  }, [searchTerm, fetchContacts]);

  const filteredContacts = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone?.includes(searchTerm),
  );

  const handleEdit = (contact: Contact) => {
    setSelectedContact(contact);
    setDialogOpen(true);
  };

  const navigate = useNavigate();

  const handleRowClick = (contact: Contact) => {
    // navigate to the contact profile page instead of opening a modal
    navigate(`/contacts/${contact.id}`, { state: { id: contact.id } });
  };

  const handleAdd = () => {
    setSelectedContact(null);
    setDialogOpen(true);
  };

  const handleDialogClose = (refresh?: boolean) => {
    setDialogOpen(false);
    setSelectedContact(null);
    if (refresh) void fetchContacts();
  };

  if (loading) {
    // show skeleton table to make initial load feel static
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>

        <div className="overflow-x-auto bg-card p-4 rounded-md shadow-sm">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left">&nbsp;</th>
                <th className="px-4 py-3 text-left">&nbsp;</th>
                <th className="px-4 py-3 text-left">&nbsp;</th>
                <th className="px-4 py-3 text-left">&nbsp;</th>
                <th className="px-4 py-3 text-left">&nbsp;</th>
                <th className="px-4 py-3 text-left">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search customer contacts by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer Contact
        </Button>
      </div>

      <div className="overflow-x-auto bg-card p-4 rounded-md shadow-sm">
        <table className="min-w-full divide-y divide-border">
          <thead>
                <tr className="text-sm text-muted-foreground">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  {isAdmin && <th className="px-4 py-3 text-left">Assigned To</th>}
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
          </thead>
          <tbody className="divide-y">
            {filteredContacts.map((contact) => (
              <tr
                key={contact.id}
                className="hover:bg-muted/5 cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(contact)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleRowClick(contact);
                }}
              >
                <td className="px-4 py-3">{contact.name}</td>
                <td className="px-4 py-3">{contact.email ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">{contact.phone ?? <span className="text-muted-foreground">—</span>}</td>
                {isAdmin && (
                  <td className="px-4 py-3">{contact.assigned_user_name ?? (contact.assigned_user_id ? contact.assigned_user_id : <span className="text-muted-foreground">—</span>)}</td>
                )}
                <td className="px-4 py-3">{new Date(contact.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        const canEdit = isAdmin || contact.created_by === user?.id || contact.assigned_user_id === user?.id;
                        if (canEdit) handleEdit(contact);
                        else toast.error("You don't have permission to edit this customer contact");
                      }}
                      aria-label="Edit customer contact"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        const canDelete = isAdmin || contact.created_by === user?.id || contact.assigned_user_id === user?.id;
                        if (canDelete) {
                          setContactToDelete(contact);
                          setConfirmOpen(true);
                        } else {
                          toast.error("You don't have permission to delete this customer contact");
                        }
                      }}
                      aria-label="Delete customer contact"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredContacts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">No customer contacts found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ContactDialog open={dialogOpen} onClose={handleDialogClose} contact={selectedContact} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => setConfirmOpen(open)}
        title="Delete customer contact"
        description="Are you sure you want to delete this customer contact? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!contactToDelete) return;
          setConfirmOpen(false);
          try {
            const { error } = await supabase.from("contacts").delete().eq("id", contactToDelete.id);
            if (error) throw error;
            toast.success("Customer contact deleted");
            void fetchContacts();
          } catch (err) {
            console.error(err);
            toast.error("Failed to delete customer contact");
          } finally {
            setContactToDelete(null);
          }
        }}
      />
      {/* Contact profile is now a dedicated page at /contacts/:id; modal removed */}
    </div>
  );
};

export default ContactsList;
