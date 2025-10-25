-- Create app_role enum for role-based access control
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create purchases table
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  item TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on purchases
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Create voucher_rules table
CREATE TABLE public.voucher_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  min_purchase_amount DECIMAL(10, 2),
  max_discount_amount DECIMAL(10, 2),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on voucher_rules
ALTER TABLE public.voucher_rules ENABLE ROW LEVEL SECURITY;

-- Create vouchers table
CREATE TABLE public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  voucher_rule_id UUID REFERENCES public.voucher_rules(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL UNIQUE,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on vouchers
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX idx_contacts_assigned_user_id ON public.contacts(assigned_user_id);
CREATE INDEX idx_purchases_company_id ON public.purchases(company_id);
CREATE INDEX idx_purchases_contact_id ON public.purchases(contact_id);
CREATE INDEX idx_vouchers_company_id ON public.vouchers(company_id);
CREATE INDEX idx_vouchers_contact_id ON public.vouchers(contact_id);
CREATE INDEX idx_voucher_rules_company_id ON public.voucher_rules(company_id);
-- Case-insensitive unique index on company name to avoid duplicate companies with same name
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_name_ci ON public.companies (lower(name));

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE id = _user_id
$$;

-- RLS Policies for companies
CREATE POLICY "Users can view their own company"
ON public.companies FOR SELECT
USING (id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can update their company"
ON public.companies FOR UPDATE
USING (
  id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for profiles
CREATE POLICY "Users can view profiles in their company"
ON public.profiles FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles in their company"
ON public.user_roles FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
    AND company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Admins can insert roles for users in their company"
ON public.user_roles FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
    AND company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Admins can delete roles for users in their company"
ON public.user_roles FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
    AND company_id = public.get_user_company_id(auth.uid())
  )
);

-- RLS Policies for contacts
CREATE POLICY "Users can view contacts in their company"
ON public.contacts FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create contacts in their company"
ON public.contacts FOR INSERT
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND created_by = auth.uid()
);

CREATE POLICY "Admins can update all contacts in their company"
ON public.contacts FOR UPDATE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can update their own contacts"
ON public.contacts FOR UPDATE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (created_by = auth.uid() OR assigned_user_id = auth.uid())
);

CREATE POLICY "Admins can delete contacts in their company"
ON public.contacts FOR DELETE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for purchases
CREATE POLICY "Users can view purchases in their company"
ON public.purchases FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Users can create purchases for their contacts"
ON public.purchases FOR INSERT
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.contacts
    WHERE id = contact_id
    AND (created_by = auth.uid() OR assigned_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

CREATE POLICY "Admins can update purchases in their company"
ON public.purchases FOR UPDATE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete purchases in their company"
ON public.purchases FOR DELETE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for voucher_rules
CREATE POLICY "Users can view voucher rules in their company"
ON public.voucher_rules FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can manage voucher rules in their company"
ON public.voucher_rules FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for vouchers
CREATE POLICY "Users can view vouchers in their company"
ON public.vouchers FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can issue vouchers in their company"
ON public.vouchers FOR INSERT
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin')
  AND issued_by = auth.uid()
);

CREATE POLICY "Users can redeem vouchers for their contacts"
ON public.vouchers FOR UPDATE
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.contacts
    WHERE id = contact_id
    AND (created_by = auth.uid() OR assigned_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at columns
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_voucher_rules_updated_at
BEFORE UPDATE ON public.voucher_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
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
  -- Extract company info from metadata
  _company_name := NEW.raw_user_meta_data->>'company_name';
  _company_id := (NEW.raw_user_meta_data->>'company_id')::UUID;
  _user_role := (NEW.raw_user_meta_data->>'role')::app_role;

  -- If no company_id provided, try to find an existing company by name (case-insensitive)
  IF _company_id IS NULL THEN
    IF _company_name IS NOT NULL THEN
      SELECT id INTO _company_id FROM public.companies WHERE lower(name) = lower(_company_name) LIMIT 1;
    END IF;
  END IF;

  -- If still no company_id, create a new company (first user becomes admin)
  IF _company_id IS NULL THEN
    INSERT INTO public.companies (name)
    VALUES (COALESCE(_company_name, 'My Company'))
    RETURNING id INTO _company_id;
    _user_role := 'admin';
  ELSE
    -- If joining an existing company by name, default role to 'user' unless explicitly provided
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

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();