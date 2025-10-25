-- Safe company lookup/creation for new user signups
-- This migration replaces the signup trigger function with a version that
-- handles concurrent signups with the same company name by catching unique
-- violations and resolving to the existing company id.

-- Create a safe handler function
CREATE OR REPLACE FUNCTION public.handle_new_user_safe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id UUID;
  _company_name TEXT;
  _user_role app_role;
BEGIN
  _company_name := NEW.raw_user_meta_data->>'company_name';
  _company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
  _user_role := (NEW.raw_user_meta_data->>'role')::app_role;

  -- If no company_id provided, try to find an existing company by name
  IF _company_id IS NULL THEN
    IF _company_name IS NOT NULL THEN
      SELECT id INTO _company_id FROM public.companies WHERE lower(name) = lower(_company_name) LIMIT 1;
    END IF;
  END IF;

  -- If still no company_id, attempt to insert the company but handle unique conflicts
  IF _company_id IS NULL THEN
    BEGIN
      INSERT INTO public.companies (name)
      VALUES (COALESCE(_company_name, 'My Company'))
      RETURNING id INTO _company_id;
      _user_role := 'admin';
    EXCEPTION WHEN unique_violation THEN
      -- Another process inserted the same-named company concurrently; fetch it
      SELECT id INTO _company_id FROM public.companies WHERE lower(name) = lower(_company_name) LIMIT 1;
      IF _company_id IS NULL THEN
        RAISE;
      END IF;
    END;
  ELSE
    -- Joining an existing company by id/name -> default to 'user' unless role provided
    IF _user_role IS NULL THEN
      _user_role := 'user';
    END IF;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, company_id, email, full_name)
  VALUES (
    NEW.id,
    _company_id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );

  -- Assign role (default to 'user' if not specified)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(_user_role, 'user'));

  RETURN NEW;
END;
$$;

-- Replace existing trigger to use the safe handler
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_safe();
