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
import ContactProfileModal from "./ContactProfileModal";

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
}

const ContactsList = () => {
  const { profile, isAdmin, user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

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
        toast.error("Failed to load contacts");
        console.error(error);
        setContacts([]);
      } else {
        const rows = (data as Contact[]) || [];

        // keep access rules (users still see contacts they created or are assigned to)
        const visible: Contact[] = isAdmin
          ? rows
          : rows.filter((c) => c.created_by === user?.id || c.assigned_user_id === user?.id);

        setContacts(visible);
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

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const handleRowClick = (contact: Contact) => {
    setSelectedContactId(contact.id);
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
            placeholder="Search contacts by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      <div className="overflow-x-auto bg-card p-4 rounded-md shadow-sm">
        <table className="min-w-full divide-y divide-border">
          <thead>
                <tr className="text-sm text-muted-foreground">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Phone</th>
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
                        else toast.error("You don't have permission to edit this contact");
                      }}
                      aria-label="Edit contact"
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
                          setSelectedContact(contact);
                          setDialogOpen(true);
                        } else {
                          toast.error("You don't have permission to delete this contact");
                        }
                      }}
                      aria-label="Delete contact"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredContacts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">No contacts found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ContactDialog open={dialogOpen} onClose={handleDialogClose} contact={selectedContact} />
      {/* Contact profile modal (opened when a row is clicked) */}
      {selectedContactId && (
        // lazy load the modal component to avoid code duplication; render inline
        <ContactProfileModal
          open={Boolean(selectedContactId)}
          onOpenChange={(open) => {
            if (!open) setSelectedContactId(null);
          }}
          contactId={selectedContactId}
        />
      )}
    </div>
  );
};

export default ContactsList;
