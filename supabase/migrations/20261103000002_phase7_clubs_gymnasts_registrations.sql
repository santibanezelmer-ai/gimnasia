-- ==============================================================================
-- Migration: 20261103000002_phase7_clubs_gymnasts_registrations.sql
-- Description: Multi-tenant schema for Clubs, Gymnasts, Coaches, and Registrations
--              with strict RLS ensuring clubs only access their own data.
-- ==============================================================================

-- 1. Create Enums
CREATE TYPE public.registration_status AS ENUM (
  'pending_approval',
  'approved',
  'rejected',
  'scratched'  -- Gymnast withdrew / injured
);

-- 2. Create Clubs Table
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT,
  code TEXT NOT NULL,               -- e.g. "CGC" (Club Gimnástico Central)
  logo_url TEXT,
  city TEXT,
  state_or_region TEXT,
  country TEXT NOT NULL DEFAULT 'Chile',
  contact_email TEXT,
  contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_club_org_code UNIQUE (organization_id, code)
);

-- 3. Associate Users with Clubs (for club_manager / coach roles)
CREATE TABLE IF NOT EXISTS public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'coach', -- 'manager', 'coach'
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_club_user UNIQUE (club_id, user_id)
);

-- 4. Create Gymnasts (Athletes) Table
CREATE TABLE IF NOT EXISTS public.gymnasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  rut_or_id TEXT,                    -- National ID / RUT / Passport
  license_number TEXT,               -- Federation License number
  birth_date DATE NOT NULL,
  gender public.gender_category NOT NULL DEFAULT 'female',
  medical_clearance_date DATE,       -- Private to club & org admin
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Create Championship Registrations Table
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  gymnast_id UUID NOT NULL REFERENCES public.gymnasts(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  bib_number INT,                    -- Number printed on athlete's uniform
  rotation_group TEXT,               -- e.g. "Rotación 1 - Grupo A"
  status public.registration_status NOT NULL DEFAULT 'pending_approval',
  approved_at TIMESTAMPTZ,
  approved_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_registration_champ_gymnast UNIQUE (championship_id, gymnast_id)
);

-- Indexes for performant multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_clubs_org ON public.clubs(organization_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user ON public.club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_gymnasts_club ON public.gymnasts(club_id);
CREATE INDEX IF NOT EXISTS idx_gymnasts_org ON public.gymnasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_registrations_champ ON public.registrations(championship_id);
CREATE INDEX IF NOT EXISTS idx_registrations_club ON public.registrations(club_id);
CREATE INDEX IF NOT EXISTS idx_registrations_category ON public.registrations(category_id);

-- Helper function: check if current user is an authorized member of a specific club
CREATE OR REPLACE FUNCTION public.current_user_belongs_to_club(target_club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = target_club_id AND user_id = auth.uid()
  );
$$;

-- ==============================================================================
-- 6. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gymnasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS: public.clubs
-- ------------------------------------------------------------------------------
CREATE POLICY "Clubs are viewable by members of the same organization"
  ON public.clubs
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  );

CREATE POLICY "Org managers can create clubs"
  ON public.clubs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
    )
  );

CREATE POLICY "Org managers or club managers can update their club"
  ON public.clubs
  FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
    )
    OR public.current_user_belongs_to_club(id)
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
    )
    OR public.current_user_belongs_to_club(id)
  );

-- ------------------------------------------------------------------------------
-- RLS: public.club_members
-- ------------------------------------------------------------------------------
CREATE POLICY "Club members are viewable by co-members or org admins"
  ON public.club_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_belongs_to_club(club_id)
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_members.club_id
        AND public.current_user_has_org_role(
          c.organization_id,
          ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
        )
    )
  );

-- ------------------------------------------------------------------------------
-- RLS: public.gymnasts (Strict club isolation for sensitive data)
-- ------------------------------------------------------------------------------
CREATE POLICY "Gymnasts are readable by their club or org managers"
  ON public.gymnasts
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_belongs_to_club(club_id)
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role, 'head_judge'::public.organization_role]
    )
  );

CREATE POLICY "Club members or org managers can manage gymnasts"
  ON public.gymnasts
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_belongs_to_club(club_id)
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_belongs_to_club(club_id)
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
    )
  );

-- ------------------------------------------------------------------------------
-- RLS: public.registrations
-- ------------------------------------------------------------------------------
CREATE POLICY "Registrations are viewable by org members and public if approved"
  ON public.registrations
  FOR SELECT
  TO public
  USING (
    status = 'approved'
    OR (
      auth.uid() IS NOT NULL AND (
        public.is_platform_admin(auth.uid())
        OR public.current_user_belongs_to_club(club_id)
        OR EXISTS (
          SELECT 1 FROM public.championships c
          WHERE c.id = registrations.championship_id
            AND public.current_user_has_org_role(
              c.organization_id,
              ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role, 'head_judge'::public.organization_role, 'judge'::public.organization_role]
            )
        )
      )
    )
  );

CREATE POLICY "Club members or org managers can create registrations"
  ON public.registrations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_belongs_to_club(club_id)
    OR EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = championship_id
        AND public.current_user_has_org_role(
          c.organization_id,
          ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
        )
    )
  );

CREATE POLICY "Org managers can approve or update registrations"
  ON public.registrations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = registrations.championship_id
        AND public.current_user_has_org_role(
          c.organization_id,
          ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
        )
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = registrations.championship_id
        AND public.current_user_has_org_role(
          c.organization_id,
          ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
        )
    )
  );
