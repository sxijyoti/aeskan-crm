-- Enable Row Level Security and add policies for the `contacts` table.
-- Ensures multi-tenant isolation: users can only operate on contacts in their company.
-- Admins may create contacts assigned to any user in their company.
-- Regular users can create contacts assigned to themselves only.

BEGIN;

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Allow SELECT for rows that belong to the caller's company
-- Allow SELECT for rows that belong to the caller's company, but restrict visibility based on role:
-- - Admins see all rows in the company
-- - Regular users only see rows they created or that are assigned to them
CREATE POLICY "contacts_select_by_company" ON public.contacts
  FOR SELECT
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role('admin'::public.app_role, auth.uid())
      OR created_by = auth.uid()
      OR assigned_user_id = auth.uid()
    )
  );

-- Allow INSERT only when the new row's company matches the caller's company
-- Admins may insert rows assigned to any user in the same company.
-- Non-admin users may only create rows they own and which are assigned to themselves (or unassigned).
CREATE POLICY "contacts_insert_by_company_and_role" ON public.contacts
  FOR INSERT
  WITH CHECK (
    new.company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role('admin'::public.app_role, auth.uid())
      OR (new.created_by = auth.uid() AND (new.assigned_user_id = auth.uid() OR new.assigned_user_id IS NULL))
    )
  );

-- Allow UPDATE for rows in the same company. Admins can update any row in the company.
-- Non-admins can update rows they created or rows assigned to them.
CREATE POLICY "contacts_update_by_company_and_role" ON public.contacts
  FOR UPDATE
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role('admin'::public.app_role, auth.uid())
      OR (created_by = auth.uid())
      OR (assigned_user_id = auth.uid())
    )
  )
  WITH CHECK (
    new.company_id = public.get_user_company_id(auth.uid())
  );

-- Allow DELETE for admins and owners/assignees within the company
CREATE POLICY "contacts_delete_by_company_and_role" ON public.contacts
  FOR DELETE
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role('admin'::public.app_role, auth.uid())
      OR (created_by = auth.uid())
      OR (assigned_user_id = auth.uid())
    )
  );

COMMIT;
