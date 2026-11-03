-- ==============================================================================
-- Migration: 20261103000001_phase6_championships_and_technical_setup.sql
-- Description: Schema for Championships, Gymnastics Disciplines, Apparatuses,
--              Categories, Subcategories and strict multi-tenant RLS policies.
-- ==============================================================================

-- 1. Create Enums
CREATE TYPE public.championship_visibility AS ENUM (
  'public',
  'private',
  'invitational'
);

CREATE TYPE public.championship_status AS ENUM (
  'draft',
  'registration_open',
  'registration_closed',
  'in_progress',
  'completed',
  'archived'
);

CREATE TYPE public.gymnastics_discipline_code AS ENUM (
  'GAF',  -- Women's Artistic Gymnastics
  'GAM',  -- Men's Artistic Gymnastics
  'GR',   -- Rhythmic Gymnastics
  'TRA',  -- Trampoline Gymnastics
  'AER',  -- Aerobic Gymnastics
  'ACRO'  -- Acrobatic Gymnastics
);

CREATE TYPE public.gender_category AS ENUM (
  'female',
  'male',
  'mixed'
);

-- 2. Create Championships Table
CREATE TABLE IF NOT EXISTS public.championships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location TEXT,
  venue_name TEXT,
  visibility public.championship_visibility NOT NULL DEFAULT 'public',
  status public.championship_status NOT NULL DEFAULT 'draft',
  ruleset_version TEXT NOT NULL DEFAULT 'FIG_2025_2028_V1',
  scoring_schema_version TEXT NOT NULL DEFAULT 'FIG_STANDARD_V1',
  banner_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_championship_org_slug UNIQUE (organization_id, slug),
  CONSTRAINT chk_championship_dates CHECK (end_date >= start_date)
);

-- 3. Create Standard Apparatuses Table (Catalog of Olympic and Technical Apparatuses)
CREATE TABLE IF NOT EXISTS public.apparatuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline public.gymnastics_discipline_code NOT NULL,
  code TEXT NOT NULL,         -- e.g. "VT", "UB", "BB", "FX", "PH", "SR", "PB", "HB"
  name TEXT NOT NULL,         -- e.g. "Salto", "Barras Asimétricas", "Viga", "Suelo"
  sort_order INT NOT NULL DEFAULT 0,
  icon_name TEXT,
  CONSTRAINT uq_apparatus_discipline_code UNIQUE (discipline, code)
);

-- Seed Olympic standard apparatuses for GAF and GAM
INSERT INTO public.apparatuses (discipline, code, name, sort_order) VALUES
  -- GAF (Women's Artistic Gymnastics)
  ('GAF', 'VT', 'Salto de Caballo / Salto', 1),
  ('GAF', 'UB', 'Barras Asimétricas', 2),
  ('GAF', 'BB', 'Viga de Equilibrio', 3),
  ('GAF', 'FX', 'Suelo / Manos Libres', 4),
  -- GAM (Men's Artistic Gymnastics)
  ('GAM', 'FX', 'Suelo', 1),
  ('GAM', 'PH', 'Caballo con Arzones', 2),
  ('GAM', 'SR', 'Anillas', 3),
  ('GAM', 'VT', 'Salto', 4),
  ('GAM', 'PB', 'Barras Paralelas', 5),
  ('GAM', 'HB', 'Barra Fija', 6),
  -- GR (Rhythmic Gymnastics)
  ('GR', 'HOOP', 'Aro', 1),
  ('GR', 'BALL', 'Pelota', 2),
  ('GR', 'CLUBS', 'Mazas', 3),
  ('GR', 'RIBBON', 'Cinta', 4)
ON CONFLICT (discipline, code) DO NOTHING;

-- 4. Create Championship Categories Table (e.g. FIG Senior, AC4, USAG Level 4)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  discipline public.gymnastics_discipline_code NOT NULL DEFAULT 'GAF',
  name TEXT NOT NULL,               -- e.g. "Nivel 3", "FIG Junior", "Infantil B"
  code TEXT NOT NULL,               -- e.g. "LVL3", "FIG-JR"
  gender public.gender_category NOT NULL DEFAULT 'female',
  min_age INT,
  max_age INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_category_champ_code UNIQUE (championship_id, code)
);

-- 5. Create Subcategories / Age Groups Table (e.g. 7-8 años, 9-10 años)
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,               -- e.g. "Sub-8", "Sub-10", "Mayor"
  min_age INT,
  max_age INT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Mapping: Apparatuses applicable to each Category
CREATE TABLE IF NOT EXISTS public.category_apparatuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  apparatus_id UUID NOT NULL REFERENCES public.apparatuses(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_category_apparatus UNIQUE (category_id, apparatus_id)
);

-- Indexes for performant lookup
CREATE INDEX IF NOT EXISTS idx_championships_org ON public.championships(organization_id);
CREATE INDEX IF NOT EXISTS idx_championships_status ON public.championships(status);
CREATE INDEX IF NOT EXISTS idx_categories_champ ON public.categories(championship_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON public.subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_category_apparatuses_cat ON public.category_apparatuses(category_id);

-- ==============================================================================
-- 7. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apparatuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_apparatuses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS: public.apparatuses (Catalog is globally readable by authenticated users)
-- ------------------------------------------------------------------------------
CREATE POLICY "Apparatuses are readable by everyone"
  ON public.apparatuses
  FOR SELECT
  TO public
  USING (true);

-- ------------------------------------------------------------------------------
-- RLS: public.championships
-- ------------------------------------------------------------------------------
CREATE POLICY "Public championships are visible to anyone"
  ON public.championships
  FOR SELECT
  TO public
  USING (
    visibility = 'public'
    OR (
      auth.uid() IS NOT NULL AND (
        public.is_platform_admin(auth.uid())
        OR organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
      )
    )
  );

CREATE POLICY "Org managers can create championships in their organization"
  ON public.championships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
    )
  );

CREATE POLICY "Org managers can update their organization championships"
  ON public.championships
  FOR UPDATE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
    )
  );

CREATE POLICY "Org admins can delete championships in their organization"
  ON public.championships
  FOR DELETE
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role]
    )
  );

-- ------------------------------------------------------------------------------
-- RLS: public.categories
-- ------------------------------------------------------------------------------
CREATE POLICY "Categories are readable if championship is visible"
  ON public.categories
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = categories.championship_id
        AND (
          c.visibility = 'public'
          OR (
            auth.uid() IS NOT NULL AND (
              public.is_platform_admin(auth.uid())
              OR c.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
            )
          )
        )
    )
  );

CREATE POLICY "Org managers can manage categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = categories.championship_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.current_user_has_org_role(
            c.organization_id,
            ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = categories.championship_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.current_user_has_org_role(
            c.organization_id,
            ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
          )
        )
    )
  );

-- ------------------------------------------------------------------------------
-- RLS: public.subcategories & category_apparatuses (Inherit category visibility)
-- ------------------------------------------------------------------------------
CREATE POLICY "Subcategories are readable if parent category is visible"
  ON public.subcategories
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.categories cat
      WHERE cat.id = subcategories.category_id
    )
  );

CREATE POLICY "Org managers can manage subcategories"
  ON public.subcategories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.categories cat
      JOIN public.championships c ON c.id = cat.championship_id
      WHERE cat.id = subcategories.category_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.current_user_has_org_role(
            c.organization_id,
            ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
          )
        )
    )
  );

CREATE POLICY "Category apparatuses are readable if parent category is visible"
  ON public.category_apparatuses
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.categories cat
      WHERE cat.id = category_apparatuses.category_id
    )
  );

CREATE POLICY "Org managers can manage category apparatuses"
  ON public.category_apparatuses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.categories cat
      JOIN public.championships c ON c.id = cat.championship_id
      WHERE cat.id = category_apparatuses.category_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.current_user_has_org_role(
            c.organization_id,
            ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role]
          )
        )
    )
  );
