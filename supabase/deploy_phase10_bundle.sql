-- ==============================================================================
-- OPERIX GYMNASTICS — BUNDLE CONSOLIDADO DE DESPLIEGUE CONTROLADO (FASES 8, 9, 10)
-- Desarrollado por Comercial Hels SpA
-- Fecha: 5 de noviembre de 2026
--
-- Contiene la secuencia ordenada, transaccional e idempotente de las migraciones pendientes.
-- Ejecutar en el SQL Editor de Supabase tras autorizar el despliegue.
-- ==============================================================================

BEGIN;

-- >>>>>>>>>> INICIO MIGRACIÓN: 20261105000001_competition_schedule_and_marshaling.sql <<<<<<<<<<

-- ==============================================================================
-- Migration: 20261105000001_competition_schedule_and_marshaling.sql
-- Description: Competition Schedule, Subdivisions, Olympic Rotations, and Live Marshaling.
-- Author: Desarrollado por Comercial Hels SpA
-- ==============================================================================

-- 1. Extend registrations table with subdivision, starting apparatus, and start order
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS subdivision TEXT,
  ADD COLUMN IF NOT EXISTS starting_apparatus TEXT,
  ADD COLUMN IF NOT EXISTS start_order INT;

COMMENT ON COLUMN public.registrations.subdivision IS 'e.g. Subdivisión 1, Turno Mañana';
COMMENT ON COLUMN public.registrations.starting_apparatus IS 'Starting apparatus code (e.g. VT, UB, BB, FX)';
COMMENT ON COLUMN public.registrations.start_order IS 'Running order sequence within the rotation group / apparatus (1, 2, 3...)';

CREATE INDEX IF NOT EXISTS idx_registrations_subdiv ON public.registrations(championship_id, subdivision);
CREATE INDEX IF NOT EXISTS idx_registrations_rot_app ON public.registrations(championship_id, rotation_group, starting_apparatus);

-- 2. Create competition_schedules table for tournament timetable
CREATE TABLE IF NOT EXISTS public.competition_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  time_start TEXT NOT NULL,
  time_end TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category_names TEXT,
  subdivision TEXT,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comp_schedules_champ ON public.competition_schedules(championship_id, sort_order);

ALTER TABLE public.competition_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read competition schedules"
  ON public.competition_schedules FOR SELECT
  USING (true);

CREATE POLICY "Org admins manage competition schedules"
  ON public.competition_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.championships c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = competition_schedules.championship_id
        AND om.user_id = auth.uid()
        AND om.role = 'org_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.championships c
      JOIN public.organization_members om ON om.organization_id = c.organization_id
      WHERE c.id = competition_schedules.championship_id
        AND om.user_id = auth.uid()
        AND om.role = 'org_admin'
    )
  );

-- 3. Create apparatus_live_status table for live marshaling & calls
CREATE TABLE IF NOT EXISTS public.apparatus_live_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  apparatus_code TEXT NOT NULL,
  apparatus_name TEXT NOT NULL,
  current_rotation INT NOT NULL DEFAULT 1,
  current_registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  next_registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_champ_apparatus_live UNIQUE (championship_id, apparatus_code)
);

CREATE INDEX IF NOT EXISTS idx_apparatus_live_champ ON public.apparatus_live_status(championship_id);

ALTER TABLE public.apparatus_live_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read apparatus live status"
  ON public.apparatus_live_status FOR SELECT
  USING (true);

CREATE POLICY "Authorized tournament staff manage live status"
  ON public.apparatus_live_status FOR ALL
  USING (
    auth.uid() IS NOT NULL
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Enable Realtime publication on apparatus_live_status and competition_schedules
ALTER PUBLICATION supabase_realtime ADD TABLE public.apparatus_live_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_schedules;


-- >>>>>>>>>> FIN MIGRACIÓN: 20261105000001_competition_schedule_and_marshaling.sql <<<<<<<<<<

-- >>>>>>>>>> INICIO MIGRACIÓN: 20261105000002_operix_reports_documentation.sql <<<<<<<<<<

-- ==============================================================================
-- Migration: 20261105000002_operix_reports_documentation.sql
-- Description: Official Documentation, Result Books, Diplomas, and Minutes (Operix Reports).
-- Author: Desarrollado por Comercial Hels SpA
-- ==============================================================================

-- 1. Create championship_documents table for generated document audit trail
CREATE TABLE IF NOT EXISTS public.championship_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,         -- 'result_book', 'category_results', 'official_minutes', 'diplomas_batch', 'start_list', 'judging_sheets'
  title TEXT NOT NULL,
  file_format TEXT NOT NULL DEFAULT 'pdf', -- 'pdf', 'excel_csv', 'html'
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_champ_documents_champ ON public.championship_documents(championship_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_champ_documents_type ON public.championship_documents(document_type);

ALTER TABLE public.championship_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read championship documents"
  ON public.championship_documents FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users log generated documents"
  ON public.championship_documents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE public.championship_documents IS 'Audit log and version registry of official documents generated by Operix Reports';


-- >>>>>>>>>> FIN MIGRACIÓN: 20261105000002_operix_reports_documentation.sql <<<<<<<<<<

-- >>>>>>>>>> INICIO MIGRACIÓN: 20261105000003_operix_awards_and_ceremonies.sql <<<<<<<<<<

-- Operix Gymnastics — Phase 9: Operix Awards & Ceremonies
-- Ciclo Olímpico FIG 2025-2028.
-- Desarrollado por Comercial Hels SpA.

-- 1. Configuration for championship awards and ceremonies
CREATE TABLE IF NOT EXISTS public.championship_awards_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    places_awarded_count INTEGER NOT NULL DEFAULT 3,
    few_participants_rule TEXT NOT NULL DEFAULT 'standard_all', -- 'standard_all' | 'strict_n_minus_one'
    include_trophies_for_teams BOOLEAN NOT NULL DEFAULT TRUE,
    include_club_medals BOOLEAN NOT NULL DEFAULT TRUE,
    special_awards JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_champ_awards_config UNIQUE (championship_id)
);

-- 2. State tracking of award ceremonies to avoid duplicates and audit execution
CREATE TABLE IF NOT EXISTS public.championship_awards_ceremonies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    ceremony_key TEXT NOT NULL,
    ceremony_type TEXT NOT NULL, -- 'all_around' | 'apparatus' | 'team' | 'club_tally' | 'special'
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    apparatus_code TEXT,
    title TEXT NOT NULL,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'completed'
    podium_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    awarded_at TIMESTAMPTZ,
    awarded_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_champ_ceremony_key UNIQUE (championship_id, ceremony_key)
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_awards_config_champ ON public.championship_awards_config(championship_id);
CREATE INDEX IF NOT EXISTS idx_awards_ceremonies_champ_status ON public.championship_awards_ceremonies(championship_id, status);

-- Row Level Security
ALTER TABLE public.championship_awards_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_awards_ceremonies ENABLE ROW LEVEL SECURITY;

-- Policies for championship_awards_config
DROP POLICY IF EXISTS "Public and members can read awards config" ON public.championship_awards_config;
CREATE POLICY "Public and members can read awards config"
    ON public.championship_awards_config
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Org admins can manage awards config" ON public.championship_awards_config;
CREATE POLICY "Org admins can manage awards config"
    ON public.championship_awards_config
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.championships c
            JOIN public.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = championship_awards_config.championship_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'director')
        )
    );

-- Policies for championship_awards_ceremonies
DROP POLICY IF EXISTS "Public and members can read ceremonies" ON public.championship_awards_ceremonies;
CREATE POLICY "Public and members can read ceremonies"
    ON public.championship_awards_ceremonies
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Org admins and judges can manage ceremonies" ON public.championship_awards_ceremonies;
CREATE POLICY "Org admins and judges can manage ceremonies"
    ON public.championship_awards_ceremonies
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.championships c
            JOIN public.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = championship_awards_ceremonies.championship_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'director', 'judge')
        )
    );


-- >>>>>>>>>> FIN MIGRACIÓN: 20261105000003_operix_awards_and_ceremonies.sql <<<<<<<<<<

-- >>>>>>>>>> INICIO MIGRACIÓN: 20261105000004_production_stabilization_phase10.sql <<<<<<<<<<

-- Operix Gymnastics — Phase 10: Production Stabilization & Supplemental Schemas
-- Ciclo Olímpico FIG 2025-2028.
-- Desarrollado por Comercial Hels SpA.

-- 1. Detailed Score Deductions (Breakdown by Judge and Deductions Type)
CREATE TABLE IF NOT EXISTS public.score_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score_id UUID NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
    judge_id UUID REFERENCES public.judges(id) ON DELETE SET NULL,
    deduction_type TEXT NOT NULL, -- 'execution_fall', 'out_of_bounds', 'time_violation', 'landing_step', 'neutral'
    points NUMERIC(5, 3) NOT NULL, -- e.g. 0.100, 0.300, 0.500, 1.000
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_score_deductions_score ON public.score_deductions(score_id);
CREATE INDEX IF NOT EXISTS idx_score_deductions_type ON public.score_deductions(deduction_type);

ALTER TABLE public.score_deductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view official score deductions" ON public.score_deductions;
CREATE POLICY "Public can view official score deductions"
    ON public.score_deductions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_deductions.score_id
            AND s.status IN ('provisional', 'official_approved')
        )
    );

DROP POLICY IF EXISTS "Judges and admins can manage score deductions" ON public.score_deductions;
CREATE POLICY "Judges and admins can manage score deductions"
    ON public.score_deductions
    FOR ALL
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);


-- 2. Technical Inquiries (FIG Art. 5.4 Official D-Score Appeals)
CREATE TABLE IF NOT EXISTS public.technical_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    score_id UUID NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    gymnast_id UUID NOT NULL REFERENCES public.gymnasts(id) ON DELETE CASCADE,
    submitted_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    inquiry_reason TEXT NOT NULL,
    original_d_score NUMERIC(5, 3) NOT NULL,
    requested_d_score NUMERIC(5, 3),
    resolved_d_score NUMERIC(5, 3),
    fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted' | 'under_review' | 'accepted' | 'rejected'
    resolution_notes TEXT,
    resolved_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inquiries_champ ON public.technical_inquiries(championship_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_score ON public.technical_inquiries(score_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.technical_inquiries(status);

ALTER TABLE public.technical_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members and admins can view inquiries" ON public.technical_inquiries;
CREATE POLICY "Members and admins can view inquiries"
    ON public.technical_inquiries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.championships c
            JOIN public.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = technical_inquiries.championship_id
            AND om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Delegates can submit inquiries" ON public.technical_inquiries;
CREATE POLICY "Delegates can submit inquiries"
    ON public.technical_inquiries
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Head judges and admins can resolve inquiries" ON public.technical_inquiries;
CREATE POLICY "Head judges and admins can resolve inquiries"
    ON public.technical_inquiries
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.championships c
            JOIN public.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = technical_inquiries.championship_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'competition_manager', 'head_judge')
        )
    );


-- 3. Dedicated Rotation Groups
CREATE TABLE IF NOT EXISTS public.rotation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. 'Grupo 1', 'Subdivisión A', 'Rotación 1'
    subdivision TEXT,
    starting_apparatus TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_champ_rotation_group UNIQUE (championship_id, name, subdivision)
);

CREATE INDEX IF NOT EXISTS idx_rotation_groups_champ ON public.rotation_groups(championship_id, sort_order);

ALTER TABLE public.rotation_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view rotation groups" ON public.rotation_groups;
CREATE POLICY "Public can view rotation groups"
    ON public.rotation_groups
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage rotation groups" ON public.rotation_groups;
CREATE POLICY "Admins can manage rotation groups"
    ON public.rotation_groups
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.championships c
            JOIN public.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = rotation_groups.championship_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'competition_manager')
        )
    );


-- >>>>>>>>>> FIN MIGRACIÓN: 20261105000004_production_stabilization_phase10.sql <<<<<<<<<<

-- >>>>>>>>>> INICIO MIGRACIÓN: 20261105000005_operix_security_hardening.sql <<<<<<<<<<

-- ==============================================================================
-- OPERIX GYMNASTICS — MIGRACIÓN DE SEGURIDAD Y HARDENING RLS MULTI-TENANT (FASE 10.1)
-- Desarrollado por Comercial Hels SpA
-- Fecha: 5 de noviembre de 2026
--
-- Objetivo:
-- 1. Eliminar políticas excesivamente permisivas (USING(true), WITH CHECK(true), auth.uid() IS NOT NULL sin verificación de tenant).
-- 2. Establecer aislamiento multi-tenant estricto mediante la jerarquía:
--    organizations -> championships -> [sub-recursos y eventos deportivos]
-- 3. Implementar separación granular de privilegios (org_admin, competition_manager, head_judge, judge, club_manager, coach, viewer).
-- 4. Proteger entidades sensibles (technical_inquiries, score_deductions, championship_documents privados, score_audits).
-- 5. Idempotencia completa con bloques DROP POLICY IF EXISTS.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNCIONES AUXILIARES DE SEGURIDAD (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Verifica si auth.uid() tiene un rol específico en el campeonato indicado
CREATE OR REPLACE FUNCTION public.current_user_has_championship_role(
    target_championship_id UUID,
    required_roles public.organization_role[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    IF public.is_platform_admin(auth.uid()) THEN
        RETURN true;
    END IF;

    SELECT organization_id INTO v_org_id
    FROM public.championships
    WHERE id = target_championship_id;

    IF v_org_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN public.current_user_has_org_role(v_org_id, required_roles);
END;
$$;

COMMENT ON FUNCTION public.current_user_has_championship_role IS 
'Verifica si el usuario autenticado posee uno de los roles requeridos en la organización dueña del campeonato.';

-- Determina si un campeonato permite lectura pública o para el usuario autenticado
CREATE OR REPLACE FUNCTION public.can_view_championship_public_data(
    target_championship_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_champ RECORD;
BEGIN
    SELECT is_public, status, organization_id INTO v_champ
    FROM public.championships
    WHERE id = target_championship_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Si el campeonato es público o está publicado/en progreso/finalizado
    IF COALESCE(v_champ.is_public, true) = true OR v_champ.status IN ('in_progress', 'completed', 'published') THEN
        RETURN true;
    END IF;

    -- Si es privado o borrador, requiere membresía en la organización o ser admin
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    IF public.is_platform_admin(auth.uid()) THEN
        RETURN true;
    END IF;

    RETURN public.current_user_has_org_role(
        v_champ.organization_id, 
        ARRAY['org_admin', 'competition_manager', 'head_judge', 'judge', 'club_manager', 'coach', 'viewer']::public.organization_role[]
    );
END;
$$;

COMMENT ON FUNCTION public.can_view_championship_public_data IS 
'Permite lectura pública si el campeonato es público o está activo/cerrado, o valida membresía si es privado.';

-- Verifica si el usuario actual es el juez asignado a la nota o autoridad del campeonato
CREATE OR REPLACE FUNCTION public.is_judge_assigned_to_score(
    target_score_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_score RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    IF public.is_platform_admin(auth.uid()) THEN
        RETURN true;
    END IF;

    SELECT s.championship_id, s.judge_id, j.user_id, s.status INTO v_score
    FROM public.scores s
    LEFT JOIN public.judges j ON j.id = s.judge_id
    WHERE s.id = target_score_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Juez titular que emitió la nota
    IF v_score.user_id = auth.uid() THEN
        RETURN true;
    END IF;

    -- Autoridades con potestad técnica
    RETURN public.current_user_has_championship_role(
        v_score.championship_id,
        ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. TABLA: score_deductions
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.score_deductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Score deductions are viewable by public if score approved" ON public.score_deductions;
DROP POLICY IF EXISTS "Score deductions are viewable by authorized" ON public.score_deductions;
DROP POLICY IF EXISTS "Score deductions are manageable by authenticated" ON public.score_deductions;
DROP POLICY IF EXISTS "Score deductions insert by assigned judge or staff" ON public.score_deductions;
DROP POLICY IF EXISTS "Score deductions update by judge or staff" ON public.score_deductions;
DROP POLICY IF EXISTS "Score deductions delete by staff" ON public.score_deductions;
DROP POLICY IF EXISTS "Score deductions are viewable" ON public.score_deductions;

-- SELECT: Visible si el campeonato y score son públicos, o si el usuario pertenece al staff o es juez de la nota
CREATE POLICY "Score deductions are viewable"
    ON public.score_deductions
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_deductions.score_id
              AND (
                  public.can_view_championship_public_data(s.championship_id)
                  OR public.is_judge_assigned_to_score(s.id)
              )
        )
    );

-- INSERT: Solo el juez asignado a la nota o autoridades del campeonato
CREATE POLICY "Score deductions insert by assigned judge or staff"
    ON public.score_deductions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_judge_assigned_to_score(score_deductions.score_id)
    );

-- UPDATE: Solo si la nota no está cerrada/aprobada definitivamente o por head_judge/admin
CREATE POLICY "Score deductions update by judge or staff"
    ON public.score_deductions
    FOR UPDATE
    TO authenticated
    USING (
        public.is_judge_assigned_to_score(score_deductions.score_id)
    )
    WITH CHECK (
        public.is_judge_assigned_to_score(score_deductions.score_id)
    );

-- DELETE: Solo autoridades técnicas
CREATE POLICY "Score deductions delete by staff"
    ON public.score_deductions
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_deductions.score_id
              AND public.current_user_has_championship_role(
                  s.championship_id,
                  ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
              )
        )
    );


-- ------------------------------------------------------------------------------
-- 3. TABLA: technical_inquiries (Reclamos Técnicos - FIG Art. 5.4)
-- Confidenciales entre la delegación reclamante y el jurado de apelación.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.technical_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inquiries viewable by org staff" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Delegates can submit inquiries" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Head judges and admins can resolve inquiries" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries viewable by staff or submitter" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries submission by club delegates or staff" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries resolution by head judges or admins" ON public.technical_inquiries;

-- SELECT: Solo staff del campeonato O el usuario que lo ingresó O miembros del club reclamante
CREATE POLICY "Inquiries viewable by staff or submitter"
    ON public.technical_inquiries
    FOR SELECT
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.current_user_has_championship_role(
            technical_inquiries.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
        OR technical_inquiries.submitted_by = auth.uid()
        OR (
            technical_inquiries.club_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.club_members cm
                WHERE cm.club_id = technical_inquiries.club_id
                  AND cm.user_id = auth.uid()
            )
        )
    );

-- INSERT: Solo delegados del club reclamante inscritos o staff
CREATE POLICY "Inquiries submission by club delegates or staff"
    ON public.technical_inquiries
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR public.current_user_has_championship_role(
            technical_inquiries.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
        OR (
            technical_inquiries.submitted_by = auth.uid()
            AND (
                technical_inquiries.club_id IS NULL OR EXISTS (
                    SELECT 1 FROM public.club_members cm
                    WHERE cm.club_id = technical_inquiries.club_id
                      AND cm.user_id = auth.uid()
                )
            )
        )
    );

-- UPDATE: Exclusivo para resolución por Juez Árbitro (head_judge) o administradores
CREATE POLICY "Inquiries resolution by head judges or admins"
    ON public.technical_inquiries
    FOR UPDATE
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.current_user_has_championship_role(
            technical_inquiries.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
    )
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR public.current_user_has_championship_role(
            technical_inquiries.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
    );


-- ------------------------------------------------------------------------------
-- 4. TABLA: competition_schedules (Cronograma y Subdivisiones)
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.competition_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view schedules" ON public.competition_schedules;
DROP POLICY IF EXISTS "Admins can manage schedules" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules viewable by public or members" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules insert by org managers" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules update by org managers" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules delete by org managers" ON public.competition_schedules;

CREATE POLICY "Schedules viewable by public or members"
    ON public.competition_schedules
    FOR SELECT
    TO public
    USING (
        public.can_view_championship_public_data(competition_schedules.championship_id)
    );

CREATE POLICY "Schedules insert by org managers"
    ON public.competition_schedules
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_has_championship_role(
            competition_schedules.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );

CREATE POLICY "Schedules update by org managers"
    ON public.competition_schedules
    FOR UPDATE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            competition_schedules.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    )
    WITH CHECK (
        public.current_user_has_championship_role(
            competition_schedules.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );

CREATE POLICY "Schedules delete by org managers"
    ON public.competition_schedules
    FOR DELETE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            competition_schedules.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );


-- ------------------------------------------------------------------------------
-- 5. TABLA: apparatus_live_status (Semáforo y Control de Aparato en Vivo)
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.apparatus_live_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view live apparatus status" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Authorized staff can update live status" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status viewable by public" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status insert by staff" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status update by staff or judges" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status delete by managers" ON public.apparatus_live_status;

CREATE POLICY "Apparatus live status viewable by public"
    ON public.apparatus_live_status
    FOR SELECT
    TO public
    USING (
        public.can_view_championship_public_data(apparatus_live_status.championship_id)
    );

CREATE POLICY "Apparatus live status insert by staff"
    ON public.apparatus_live_status
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_has_championship_role(
            apparatus_live_status.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
    );

CREATE POLICY "Apparatus live status update by staff or judges"
    ON public.apparatus_live_status
    FOR UPDATE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            apparatus_live_status.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge', 'judge']::public.organization_role[]
        )
    )
    WITH CHECK (
        public.current_user_has_championship_role(
            apparatus_live_status.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge', 'judge']::public.organization_role[]
        )
    );

CREATE POLICY "Apparatus live status delete by managers"
    ON public.apparatus_live_status
    FOR DELETE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            apparatus_live_status.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );


-- ------------------------------------------------------------------------------
-- 6. TABLA: rotation_groups (Grupos de Rotación y Marshaling)
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.rotation_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view rotation groups" ON public.rotation_groups;
DROP POLICY IF EXISTS "Admins can manage rotation groups" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups viewable" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups insert by managers" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups update by managers" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups delete by managers" ON public.rotation_groups;

CREATE POLICY "Rotation groups viewable"
    ON public.rotation_groups
    FOR SELECT
    TO public
    USING (
        public.can_view_championship_public_data(rotation_groups.championship_id)
    );

CREATE POLICY "Rotation groups insert by managers"
    ON public.rotation_groups
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_has_championship_role(
            rotation_groups.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );

CREATE POLICY "Rotation groups update by managers"
    ON public.rotation_groups
    FOR UPDATE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            rotation_groups.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    )
    WITH CHECK (
        public.current_user_has_championship_role(
            rotation_groups.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );

CREATE POLICY "Rotation groups delete by managers"
    ON public.rotation_groups
    FOR DELETE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            rotation_groups.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );


-- ------------------------------------------------------------------------------
-- 7. TABLA: championship_documents (Operix Reports)
-- Distingue entre documentos oficiales públicos (Result Book, Diplomas aprobados)
-- y documentos técnicos restringidos (Actas de Jueces, Observaciones técnicas).
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.championship_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Championship documents are viewable by all" ON public.championship_documents;
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON public.championship_documents;
DROP POLICY IF EXISTS "Managers can update documents" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents select policy" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents insert policy" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents update policy" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents delete policy" ON public.championship_documents;

CREATE POLICY "Championship documents select policy"
    ON public.championship_documents
    FOR SELECT
    TO public
    USING (
        -- Documentos públicos marcados explícitamente y con campeonato accesible
        (
            COALESCE(championship_documents.is_public, true) = true
            AND public.can_view_championship_public_data(championship_documents.championship_id)
        )
        -- O usuario con credenciales técnicas en la organización
        OR (
            auth.uid() IS NOT NULL
            AND public.current_user_has_championship_role(
                championship_documents.championship_id,
                ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
            )
        )
    );

CREATE POLICY "Championship documents insert policy"
    ON public.championship_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_has_championship_role(
            championship_documents.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
    );

CREATE POLICY "Championship documents update policy"
    ON public.championship_documents
    FOR UPDATE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            championship_documents.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    )
    WITH CHECK (
        public.current_user_has_championship_role(
            championship_documents.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );

CREATE POLICY "Championship documents delete policy"
    ON public.championship_documents
    FOR DELETE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            championship_documents.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );


-- ------------------------------------------------------------------------------
-- 8. TABLA: championship_awards_config (Configuración Operix Awards)
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.championship_awards_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Championship awards config is viewable by all" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Org managers can manage awards config" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Awards config select policy" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Awards config insert policy" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Awards config update policy" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Awards config delete policy" ON public.championship_awards_config;

CREATE POLICY "Awards config select policy"
    ON public.championship_awards_config
    FOR SELECT
    TO public
    USING (
        public.can_view_championship_public_data(championship_awards_config.championship_id)
    );

CREATE POLICY "Awards config insert policy"
    ON public.championship_awards_config
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_has_championship_role(
            championship_awards_config.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );

CREATE POLICY "Awards config update policy"
    ON public.championship_awards_config
    FOR UPDATE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            championship_awards_config.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    )
    WITH CHECK (
        public.current_user_has_championship_role(
            championship_awards_config.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );

CREATE POLICY "Awards config delete policy"
    ON public.championship_awards_config
    FOR DELETE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            championship_awards_config.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );


-- ------------------------------------------------------------------------------
-- 9. TABLA: championship_awards_ceremonies (Ceremonias y Podios en Vivo)
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.championship_awards_ceremonies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ceremonies are viewable by all" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Org managers can manage ceremonies" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Awards ceremonies select policy" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Awards ceremonies insert policy" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Awards ceremonies update policy" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Awards ceremonies delete policy" ON public.championship_awards_ceremonies;

CREATE POLICY "Awards ceremonies select policy"
    ON public.championship_awards_ceremonies
    FOR SELECT
    TO public
    USING (
        public.can_view_championship_public_data(championship_awards_ceremonies.championship_id)
    );

CREATE POLICY "Awards ceremonies insert policy"
    ON public.championship_awards_ceremonies
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_has_championship_role(
            championship_awards_ceremonies.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );

CREATE POLICY "Awards ceremonies update policy"
    ON public.championship_awards_ceremonies
    FOR UPDATE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            championship_awards_ceremonies.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    )
    WITH CHECK (
        public.current_user_has_championship_role(
            championship_awards_ceremonies.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );

CREATE POLICY "Awards ceremonies delete policy"
    ON public.championship_awards_ceremonies
    FOR DELETE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            championship_awards_ceremonies.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );


-- ------------------------------------------------------------------------------
-- 10. TABLA: score_audits (Inmutabilidad de Auditoría de Puntuaciones)
-- Los registros de auditoría no pueden ser alterados ni eliminados por nadie.
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.score_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Score audits are viewable by org staff" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits insert by system or staff" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits select policy" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits insert policy" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits update policy" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits delete policy" ON public.score_audits;

-- SELECT: Solo org_admin, competition_manager, head_judge de la organización del campeonato
CREATE POLICY "Score audits select policy"
    ON public.score_audits
    FOR SELECT
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_audits.score_id
              AND public.current_user_has_championship_role(
                  s.championship_id,
                  ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
              )
        )
    );

-- INSERT: Registrado por usuarios con rol en el campeonato o triggers
CREATE POLICY "Score audits insert policy"
    ON public.score_audits
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_audits.score_id
              AND public.current_user_has_championship_role(
                  s.championship_id,
                  ARRAY['org_admin', 'competition_manager', 'head_judge', 'judge']::public.organization_role[]
              )
        )
    );

-- INMUTABILIDAD: UPDATE y DELETE están explícitamente bloqueados (sin política permisiva)
-- Al no existir políticas de UPDATE ni DELETE para authenticated/public, Postgres RLS deniega por defecto.


-- >>>>>>>>>> FIN MIGRACIÓN: 20261105000005_operix_security_hardening.sql <<<<<<<<<<

-- >>>>>>>>>> INICIO MIGRACIÓN: 20261105000006_operix_security_audit_fixes.sql <<<<<<<<<<

-- ==============================================================================
-- OPERIX GYMNASTICS — MIGRACIÓN INCREMENTAL DE CORRECCIONES DE SEGURIDAD (FASE 10.2)
-- Desarrollado por Comercial Hels SpA
-- Fecha: 5 de noviembre de 2026
--
-- Objetivo:
-- 1. Alinear funciones de seguridad con el esquema real de PostgreSQL en Supabase:
--    - championships.visibility (public, private, invitational) y status válido.
--    - scores.submitted_by_judge_id (referencia correcta a judges).
--    - technical_inquiries.submitted_by_user_id y validación de membresía de club.
--    - championship_documents.document_type y soporte de clasificación pública/privada.
-- 2. Endurecer la inmutabilidad de score_audits con triggers preventivos y REVOKE DML.
-- 3. Blindar submit_fast_judge_score impidiendo sobreescritura de notas aprobadas.
-- 4. Restringir permisos de ejecución (EXECUTE) en funciones SECURITY DEFINER.
-- 5. Plena idempotencia sin operaciones destructivas ni alteración de datos existentes.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CORRECCIÓN Y HARDENING DE: can_view_championship_public_data
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_championship_public_data(
    target_championship_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_champ RECORD;
BEGIN
    IF target_championship_id IS NULL THEN
        RETURN false;
    END IF;

    -- Selecciona usando las columnas reales del esquema: visibility, status, organization_id
    SELECT visibility, status, organization_id INTO v_champ
    FROM public.championships
    WHERE id = target_championship_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- 1. Acceso público abierto: El campeonato es 'public' y está en ciclo activo o completado
    -- (No borrador 'draft' ni archivado 'archived')
    IF v_champ.visibility = 'public' AND v_champ.status IN ('registration_open', 'registration_closed', 'in_progress', 'completed') THEN
        RETURN true;
    END IF;

    -- 2. Si no es público, requiere autenticación verificada
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- Superadministrador de la plataforma Operix
    IF public.is_platform_admin(auth.uid()) THEN
        RETURN true;
    END IF;

    -- Miembro activo de la organización propietaria del torneo
    IF public.current_user_has_org_role(
        v_champ.organization_id, 
        ARRAY['org_admin', 'competition_manager', 'head_judge', 'judge', 'club_manager', 'coach', 'viewer']::public.organization_role[]
    ) THEN
        RETURN true;
    END IF;

    -- Miembro de un club debidamente inscrito en este campeonato
    IF EXISTS (
        SELECT 1 FROM public.registrations r
        JOIN public.club_members cm ON cm.club_id = r.club_id
        WHERE r.championship_id = target_championship_id
          AND cm.user_id = auth.uid()
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_view_championship_public_data IS
'Permite lectura pública si el campeonato es visible y activo, o restringe acceso multi-tenant si es privado o borrador.';

REVOKE EXECUTE ON FUNCTION public.can_view_championship_public_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_championship_public_data(UUID) TO anon, authenticated;


-- ------------------------------------------------------------------------------
-- 2. CORRECCIÓN Y HARDENING DE: is_judge_assigned_to_score
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_judge_assigned_to_score(
    target_score_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_score RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    IF public.is_platform_admin(auth.uid()) THEN
        RETURN true;
    END IF;

    -- Resuelve con la columna exacta: submitted_by_judge_id y apparatus_id
    SELECT s.championship_id, s.apparatus_id, s.submitted_by_judge_id, s.status, j.user_id AS judge_user_id
    INTO v_score
    FROM public.scores s
    LEFT JOIN public.judges j ON j.id = s.submitted_by_judge_id
    WHERE s.id = target_score_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Si la nota ya fue aprobada y oficializada por el Juez Árbitro,
    -- un juez ordinario no puede alterarla; requiere head_judge, competition_manager u org_admin
    IF v_score.status = 'approved' THEN
        RETURN public.current_user_has_championship_role(
            v_score.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        );
    END IF;

    -- Si el usuario es el juez que emitió la nota
    IF v_score.judge_user_id = auth.uid() THEN
        RETURN true;
    END IF;

    -- Si el usuario está asignado oficialmente a calificar ese aparato en este torneo
    IF public.current_user_can_score_apparatus(v_score.championship_id, v_score.apparatus_id) THEN
        RETURN true;
    END IF;

    -- Autoridades con potestad técnica
    RETURN public.current_user_has_championship_role(
        v_score.championship_id,
        ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
    );
END;
$$;

COMMENT ON FUNCTION public.is_judge_assigned_to_score IS
'Valida que el usuario sea el juez calificador del aparato o autoridad deportiva, bloqueando jueces ordinarios si la nota ya fue aprobada.';

REVOKE EXECUTE ON FUNCTION public.is_judge_assigned_to_score(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_judge_assigned_to_score(UUID) TO authenticated;


-- ------------------------------------------------------------------------------
-- 3. PERMISOS EXECUTE EN current_user_has_championship_role
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.current_user_has_championship_role(UUID, public.organization_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_championship_role(UUID, public.organization_role[]) TO authenticated;


-- ------------------------------------------------------------------------------
-- 4. HARDENING DE: technical_inquiries (FIG Art. 5.4)
-- Validación estricta de pertenencia al club y protección contra falsificación
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.technical_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inquiries viewable by staff or submitter" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries submission by club delegates or staff" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries resolution by head judges or admins" ON public.technical_inquiries;

-- SELECT: Solo staff del campeonato O el usuario que lo ingresó O miembros del club reclamante
CREATE POLICY "Inquiries viewable by staff or submitter"
    ON public.technical_inquiries
    FOR SELECT
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.current_user_has_championship_role(
            technical_inquiries.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
        OR technical_inquiries.submitted_by_user_id = auth.uid()
        OR (
            technical_inquiries.club_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.club_members cm
                WHERE cm.club_id = technical_inquiries.club_id
                  AND cm.user_id = auth.uid()
            )
        )
    );

-- INSERT: Solo delegados del club reclamante (con inscripción en el campeonato) o staff
CREATE POLICY "Inquiries submission by club delegates or staff"
    ON public.technical_inquiries
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR public.current_user_has_championship_role(
            technical_inquiries.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
        OR (
            -- El usuario debe ser el autor explícito
            technical_inquiries.submitted_by_user_id = auth.uid()
            -- El club debe ser especificado obligatoriamente
            AND technical_inquiries.club_id IS NOT NULL
            -- El usuario debe pertenecer al club
            AND EXISTS (
                SELECT 1 FROM public.club_members cm
                WHERE cm.club_id = technical_inquiries.club_id
                  AND cm.user_id = auth.uid()
            )
            -- El club debe estar debidamente inscrito en este campeonato
            AND EXISTS (
                SELECT 1 FROM public.registrations r
                WHERE r.championship_id = technical_inquiries.championship_id
                  AND r.club_id = technical_inquiries.club_id
            )
        )
    );

-- UPDATE: Exclusivo para Juez Árbitro o Admin para emitir resolución reglamentaria
CREATE POLICY "Inquiries resolution by head judges or admins"
    ON public.technical_inquiries
    FOR UPDATE
    TO authenticated
    USING (
        public.is_platform_admin(auth.uid())
        OR public.current_user_has_championship_role(
            technical_inquiries.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
    )
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR public.current_user_has_championship_role(
            technical_inquiries.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
    );


-- ------------------------------------------------------------------------------
-- 5. HARDENING DE: championship_documents (Operix Reports)
-- Separación rigurosa entre documentos oficiales públicos y técnicos reservados
-- ------------------------------------------------------------------------------
-- Agregamos la columna is_public de forma no destructiva si no existe
ALTER TABLE IF EXISTS public.championship_documents 
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "Championship documents select policy" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents insert policy" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents update policy" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents delete policy" ON public.championship_documents;

CREATE POLICY "Championship documents select policy"
    ON public.championship_documents
    FOR SELECT
    TO public
    USING (
        -- Documentos públicos permitidos si el campeonato es accesible públicamente
        -- y el tipo de documento no corresponde a actas de deliberación de jueces
        (
            championship_documents.is_public = true
            AND championship_documents.document_type NOT IN ('official_minutes', 'judging_sheets')
            AND public.can_view_championship_public_data(championship_documents.championship_id)
        )
        -- O usuario autenticado con rol administrativo o técnico en la organización
        OR (
            auth.uid() IS NOT NULL
            AND public.current_user_has_championship_role(
                championship_documents.championship_id,
                ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
            )
        )
    );

CREATE POLICY "Championship documents insert policy"
    ON public.championship_documents
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.current_user_has_championship_role(
            championship_documents.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
    );

CREATE POLICY "Championship documents update policy"
    ON public.championship_documents
    FOR UPDATE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            championship_documents.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    )
    WITH CHECK (
        public.current_user_has_championship_role(
            championship_documents.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );

CREATE POLICY "Championship documents delete policy"
    ON public.championship_documents
    FOR DELETE
    TO authenticated
    USING (
        public.current_user_has_championship_role(
            championship_documents.championship_id,
            ARRAY['org_admin', 'competition_manager']::public.organization_role[]
        )
    );


-- ------------------------------------------------------------------------------
-- 6. INMUTABILIDAD TOTAL DE: score_audits (Garantía WORM - Write Once, Read Many)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_score_audits_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'OPERIX_SECURITY_VIOLATION: La tabla score_audits es estrictamente inmutable (append-only). Las operaciones de UPDATE y DELETE están prohibidas por normativa reglamentaria.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_score_audits_tampering ON public.score_audits;
CREATE TRIGGER trg_prevent_score_audits_tampering
    BEFORE UPDATE OR DELETE ON public.score_audits
    FOR EACH ROW EXECUTE FUNCTION public.prevent_score_audits_tampering();

-- Restricción de permisos DML a nivel relacional de PostgreSQL
REVOKE UPDATE, DELETE, TRUNCATE ON public.score_audits FROM public, anon, authenticated;
GRANT SELECT, INSERT ON public.score_audits TO authenticated;


-- ------------------------------------------------------------------------------
-- 7. BLINDAJE DE: submit_fast_judge_score CONTRA MODIFICACIÓN DE NOTAS APROBADAS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_fast_judge_score(
  p_championship_id UUID,
  p_judge_code TEXT,
  p_registration_id UUID,
  p_apparatus_id UUID,
  p_judge_name TEXT,
  p_d_score NUMERIC(5, 3),
  p_e_scores JSONB,
  p_e_score_avg NUMERIC(5, 3),
  p_neutral_deductions NUMERIC(5, 3),
  p_final_score NUMERIC(5, 3),
  p_attempt_number INT DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score_id UUID;
  v_expected_code TEXT;
  v_champ_status public.championship_status;
  v_existing_status public.score_status;
  v_attempt INT;
BEGIN
  v_attempt := COALESCE(p_attempt_number, 1);
  IF v_attempt NOT IN (1, 2) THEN
    RAISE EXCEPTION 'El número de intento debe ser 1 o 2.';
  END IF;

  -- 1. Verificar campeonato y código de juez
  SELECT judge_code, status INTO v_expected_code, v_champ_status
  FROM public.championships
  WHERE id = p_championship_id;

  IF v_expected_code IS NULL OR TRIM(UPPER(v_expected_code)) <> TRIM(UPPER(p_judge_code)) THEN
    RAISE EXCEPTION 'Código de juez inválido para este campeonato.';
  END IF;

  -- 2. Verificar que el campeonato permita registro de notas
  IF v_champ_status NOT IN ('in_progress', 'registration_closed') THEN
    RAISE EXCEPTION 'El campeonato no se encuentra en estado activo para juzgamiento en vivo.';
  END IF;

  -- 3. Verificar si la nota ya existe y si ya fue aprobada oficialmente
  SELECT status INTO v_existing_status
  FROM public.scores
  WHERE registration_id = p_registration_id
    AND apparatus_id = p_apparatus_id
    AND attempt_number = v_attempt;

  IF v_existing_status = 'approved' THEN
    RAISE EXCEPTION 'OPERIX_SECURITY_VIOLATION: La nota para este gimnasta ya ha sido aprobada oficialmente por el Juez Árbitro y no puede ser modificada desde la terminal rápida.';
  END IF;

  -- 4. Upsert de la puntuación en estado provisional
  INSERT INTO public.scores (
    championship_id,
    registration_id,
    apparatus_id,
    attempt_number,
    d_score,
    e_scores,
    e_score_avg,
    neutral_deductions,
    final_score,
    status,
    judge_name,
    notes
  )
  VALUES (
    p_championship_id,
    p_registration_id,
    p_apparatus_id,
    v_attempt,
    p_d_score,
    p_e_scores,
    p_e_score_avg,
    p_neutral_deductions,
    p_final_score,
    'provisional',
    p_judge_name,
    'Enviado en vivo desde terminal por juez: ' || p_judge_name || ' (Intento ' || v_attempt || ')'
  )
  ON CONFLICT (registration_id, apparatus_id, attempt_number)
  DO UPDATE SET
    d_score = EXCLUDED.d_score,
    e_scores = EXCLUDED.e_scores,
    e_score_avg = EXCLUDED.e_score_avg,
    neutral_deductions = EXCLUDED.neutral_deductions,
    final_score = EXCLUDED.final_score,
    status = 'provisional',
    judge_name = EXCLUDED.judge_name,
    notes = EXCLUDED.notes,
    updated_at = timezone('utc'::text, now())
  RETURNING id INTO v_score_id;

  RETURN v_score_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_fast_judge_score FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_fast_judge_score TO anon, authenticated;


-- >>>>>>>>>> FIN MIGRACIÓN: 20261105000006_operix_security_audit_fixes.sql <<<<<<<<<<

COMMIT;
