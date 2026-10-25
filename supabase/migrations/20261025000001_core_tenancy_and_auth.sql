-- ==============================================================================
-- Migration: 20261025000001_core_tenancy_and_auth.sql
-- Description: Core schema for Multi-Tenant isolation, Profiles, Organizations,
--              Memberships, and Row Level Security (RLS) policies.
-- ==============================================================================

-- 1. Create Enums
CREATE TYPE public.platform_role AS ENUM (
  'platform_admin',
  'platform_support',
  'none'
);

CREATE TYPE public.organization_role AS ENUM (
  'org_admin',
  'competition_manager',
  'head_judge',
  'judge',
  'club_manager',
  'coach',
  'viewer'
);

-- 2. Create User Profiles Table (mirrors auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  platform_role public.platform_role NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create Organizations Table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  billing_plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create Organization Members Table
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.organization_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);

-- Indexes for fast lookup
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_org_members_org_user ON public.organization_members(organization_id, user_id);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);

-- ==============================================================================
-- 5. Helper Security Definer Functions (prevents infinite recursion in RLS)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = check_user_id AND platform_role = 'platform_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_org_role(target_org_id UUID, required_roles public.organization_role[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = target_org_id
      AND user_id = auth.uid()
      AND is_active = true
      AND role = ANY(required_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_organization_ids(check_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = check_user_id AND is_active = true;
$$;

-- Trigger to automatically create profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, platform_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    'none' -- Security: platform_role can NEVER be set during signup
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to prevent privilege escalation on profiles.platform_role
CREATE OR REPLACE FUNCTION public.protect_platform_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.platform_role IS DISTINCT FROM OLD.platform_role THEN
    IF NOT public.is_platform_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Privilege escalation rejected: only a platform_admin can change platform roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_platform_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_platform_role();

-- ==============================================================================
-- 6. Enable Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS: public.profiles
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can read their own profile or co-members"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members m1
      JOIN public.organization_members m2 ON m1.organization_id = m2.organization_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
    )
  );

CREATE POLICY "Users can update their own profile details"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_platform_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- RLS: public.organizations
-- ------------------------------------------------------------------------------
CREATE POLICY "Members or platform admins can view their organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR id IN (SELECT public.get_user_organization_ids(auth.uid()))
  );

CREATE POLICY "Platform admins or org_admins can update organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(id, ARRAY['org_admin'::public.organization_role])
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(id, ARRAY['org_admin'::public.organization_role])
  );

CREATE POLICY "Authenticated users can create an organization"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- RLS: public.organization_members
-- ------------------------------------------------------------------------------
CREATE POLICY "Members can view membership within their organization"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  );

CREATE POLICY "Org admins or platform admins can manage members"
  ON public.organization_members
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(organization_id, ARRAY['org_admin'::public.organization_role])
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(organization_id, ARRAY['org_admin'::public.organization_role])
  );
