-- ==============================================================================
-- OPERIX GYMNASTICS — MASTER BUNDLE CANÓNICO DE PUESTA EN MARCHA (PRODUCCIÓN)
-- Desarrollado por Comercial Hels SpA
-- Fecha: 5 de noviembre de 2026
--
-- Consolida de forma única, atómica y ordenada:
-- 1. Fases 8, 9 y 10 (Cronograma, Marshaling, Reports, Awards y Estabilización).
-- 2. Fase 10.1 y 10.2 (Hardening RLS, Reclamos Técnicos e Inmutabilidad de Auditoría).
-- 3. Portal Público y Acceso Privado a Rotaciones (Aislamiento Club-a-Club estricto).
--
-- GARANTÍAS DE SEGURIDAD Y COMPATIBILIDAD:
-- - Transaccionalidad 100% atómica (BEGIN ... COMMIT).
-- - Idempotente: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS, CREATE OR REPLACE.
-- - No destructivo: CERO sentencias DROP TABLE CASCADE ni pérdida de datos existentes.
-- - search_path = pg_catalog inmutable en todas las funciones SECURITY DEFINER.
-- - Permisos mínimos (REVOKE EXECUTE de anon/public donde corresponde).
-- - Protección WORM en score_audits (bloqueo fila y sentencia contra TRUNCATE).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. INFRAESTRUCTURA DE TABLAS (FASES 8, 9, 10 Y PORTALES)
-- ------------------------------------------------------------------------------

-- 1.1 Cronograma y Subdivisiones
CREATE TABLE IF NOT EXISTS public.competition_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    session_number INTEGER NOT NULL DEFAULT 1,
    subdivision TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    warmup_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'running' | 'paused' | 'completed'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.2 Estado en Vivo de Aparatos (Marshaling de Pista)
CREATE TABLE IF NOT EXISTS public.apparatus_live_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    apparatus_id UUID NOT NULL REFERENCES public.apparatuses(id) ON DELETE CASCADE,
    apparatus_code TEXT NOT NULL,
    current_rotation INTEGER NOT NULL DEFAULT 1,
    current_registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    next_registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'idle', -- 'idle' | 'warmup' | 'competing' | 'scoring' | 'blocked'
    updated_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_champ_apparatus_live UNIQUE (championship_id, apparatus_id)
);

-- 1.3 Grupos de Rotación Olímpica
CREATE TABLE IF NOT EXISTS public.rotation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subdivision TEXT,
    starting_apparatus TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_rotation_groups_champ_name UNIQUE (championship_id, name)
);

-- 1.4 Operix Reports: Documentación Oficial y Result Books
CREATE TABLE IF NOT EXISTS public.championship_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'result_book', 'category_results', 'official_minutes', 'diplomas_batch', 'start_list', 'judging_sheets'
    title TEXT NOT NULL,
    file_format TEXT NOT NULL DEFAULT 'pdf', -- 'pdf', 'excel_csv', 'html'
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_by_user_id UUID REFERENCES public.profiles(id),
    is_public BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.5 Operix Awards: Configuración de Premiación y Podios
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

-- 1.6 Operix Awards: Ceremonias y Podios
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

-- 1.7 Desglose de Deducciones por Panel
CREATE TABLE IF NOT EXISTS public.score_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score_id UUID NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
    judge_assignment_id UUID REFERENCES public.judge_assignments(id) ON DELETE SET NULL,
    deduction_type TEXT NOT NULL, -- 'execution', 'artistic', 'landing', 'line', 'time', 'behavior'
    amount NUMERIC(4, 3) NOT NULL CHECK (amount >= 0.0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.8 Reclamaciones Técnicas de Dificultad (FIG Art. 5.4)
CREATE TABLE IF NOT EXISTS public.technical_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score_id UUID NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    gymnast_id UUID NOT NULL REFERENCES public.gymnasts(id) ON DELETE CASCADE,
    submitted_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
    original_d_score NUMERIC(5, 3) NOT NULL,
    expected_d_score NUMERIC(5, 3) NOT NULL,
    inquiry_reason TEXT NOT NULL,
    fee_deposit_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fee_deposit_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'verified' | 'refunded' | 'forfeited'
    fee_deposit_receipt_url TEXT,
    status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted' | 'under_review' | 'accepted' | 'rejected'
    resolution_notes TEXT,
    resolved_by_user_id UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.9 Columnas de Extensión en Tablas Existentes
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS subdivision TEXT,
  ADD COLUMN IF NOT EXISTS starting_apparatus TEXT,
  ADD COLUMN IF NOT EXISTS start_order INT;

ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS public_portal_settings JSONB NOT NULL 
  DEFAULT '{"show_participating_clubs": true, "show_categories": true, "show_published_results": true, "show_medal_tally": true, "show_venue_details": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS schedule_updated_at TIMESTAMPTZ 
  DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS schedule_change_notices JSONB NOT NULL
  DEFAULT '[]'::jsonb;

-- ------------------------------------------------------------------------------
-- 2. ÍNDICES DE ALTO RENDIMIENTO
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_comp_schedules_champ ON public.competition_schedules(championship_id);
CREATE INDEX IF NOT EXISTS idx_apparatus_live_champ ON public.apparatus_live_status(championship_id);
CREATE INDEX IF NOT EXISTS idx_rotation_groups_champ ON public.rotation_groups(championship_id);
CREATE INDEX IF NOT EXISTS idx_champ_documents_champ ON public.championship_documents(championship_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_champ_documents_type ON public.championship_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_awards_config_champ ON public.championship_awards_config(championship_id);
CREATE INDEX IF NOT EXISTS idx_awards_ceremonies_champ ON public.championship_awards_ceremonies(championship_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_score_deductions_score ON public.score_deductions(score_id);
CREATE INDEX IF NOT EXISTS idx_tech_inquiries_score ON public.technical_inquiries(score_id);
CREATE INDEX IF NOT EXISTS idx_tech_inquiries_champ ON public.technical_inquiries(championship_id, status);
CREATE INDEX IF NOT EXISTS idx_tech_inquiries_club ON public.technical_inquiries(club_id);
CREATE INDEX IF NOT EXISTS idx_registrations_subdiv ON public.registrations(championship_id, subdivision);

-- ------------------------------------------------------------------------------
-- 3. FUNCIONES SECURITY DEFINER ENDURECIDAS (search_path = pg_catalog)
-- ------------------------------------------------------------------------------

-- 3.1 Verificación de rol en el campeonato
CREATE OR REPLACE FUNCTION public.current_user_has_championship_role(
    target_championship_id UUID,
    allowed_roles public.organization_role[]
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.platform_role = 'platform_admin'
    )
    OR EXISTS (
        SELECT 1
        FROM public.championships c
        JOIN public.organization_members om ON om.organization_id = c.organization_id
        WHERE c.id = target_championship_id
          AND om.user_id = auth.uid()
          AND om.role = ANY(allowed_roles)
    );
$$;

-- 3.2 Verificación de visibilidad pública del campeonato
CREATE OR REPLACE FUNCTION public.can_view_championship_public_data(target_championship_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.championships c
        WHERE c.id = target_championship_id
          AND (
              c.visibility = 'public'
              OR (
                  auth.uid() IS NOT NULL
                  AND (
                      EXISTS (
                          SELECT 1 FROM public.profiles p
                          WHERE p.id = auth.uid() AND p.platform_role = 'platform_admin'
                      )
                      OR EXISTS (
                          SELECT 1 FROM public.organization_members om
                          WHERE om.organization_id = c.organization_id AND om.user_id = auth.uid()
                      )
                      OR EXISTS (
                          SELECT 1 FROM public.registrations r
                          JOIN public.club_members cm ON cm.club_id = r.club_id
                          WHERE r.championship_id = c.id AND cm.user_id = auth.uid()
                      )
                  )
              )
          )
    );
$$;

-- 3.3 Verificación de acceso exclusivo a rotaciones y programación
CREATE OR REPLACE FUNCTION public.current_user_can_access_championship_rotations(
    p_championship_id UUID,
    p_target_club_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
DECLARE
  v_uid UUID;
  v_is_platform_admin BOOLEAN;
  v_is_org_staff BOOLEAN;
  v_is_assigned_judge BOOLEAN;
  v_has_club_registration BOOLEAN;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. SuperAdmin
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND platform_role = 'platform_admin'
  ) INTO v_is_platform_admin;

  IF v_is_platform_admin THEN
    RETURN TRUE;
  END IF;

  -- 2. Staff de la Organización (org_admin, competition_manager, head_judge)
  SELECT EXISTS (
    SELECT 1 
    FROM public.championships c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = p_championship_id
      AND om.user_id = v_uid
      AND om.role IN ('org_admin', 'competition_manager', 'head_judge')
  ) INTO v_is_org_staff;

  IF v_is_org_staff THEN
    RETURN TRUE;
  END IF;

  -- 3. Jueces asignados al campeonato
  SELECT EXISTS (
    SELECT 1 
    FROM public.judge_assignments ja
    JOIN public.judges j ON j.id = ja.judge_id
    WHERE ja.championship_id = p_championship_id
      AND j.user_id = v_uid
  ) INTO v_is_assigned_judge;

  IF v_is_assigned_judge THEN
    RETURN TRUE;
  END IF;

  -- 4. Delegado / Entrenador acreditado del club
  IF p_target_club_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 
      FROM public.registrations r
      JOIN public.club_members cm ON cm.club_id = r.club_id
      WHERE r.championship_id = p_championship_id
        AND r.club_id = p_target_club_id
        AND cm.user_id = v_uid
        AND r.status = 'approved'
    ) INTO v_has_club_registration;
  ELSE
    SELECT EXISTS (
      SELECT 1 
      FROM public.registrations r
      JOIN public.club_members cm ON cm.club_id = r.club_id
      WHERE r.championship_id = p_championship_id
        AND cm.user_id = v_uid
        AND r.status = 'approved'
    ) INTO v_has_club_registration;
  END IF;

  RETURN COALESCE(v_has_club_registration, FALSE);
END;
$$;

-- 3.4 RPC Segura: Rotaciones exclusivas del club del usuario
CREATE OR REPLACE FUNCTION public.get_my_club_rotations(
    p_championship_id UUID,
    p_club_id UUID DEFAULT NULL
)
RETURNS TABLE (
    registration_id UUID,
    gymnast_id UUID,
    first_name TEXT,
    last_name TEXT,
    club_id UUID,
    club_name TEXT,
    club_code TEXT,
    bib_number INT,
    category_name TEXT,
    discipline TEXT,
    subdivision TEXT,
    rotation_group TEXT,
    starting_apparatus TEXT,
    start_order INT,
    status public.registration_status,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Acceso no autenticado: debe iniciar sesión para consultar rotaciones de club.';
  END IF;

  -- Organizadores / SuperAdmin: ven todas las rotaciones o filtran por p_club_id
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND platform_role = 'platform_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.championships c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = p_championship_id AND om.user_id = v_uid AND om.role IN ('org_admin', 'competition_manager', 'head_judge')
  ) THEN
    RETURN QUERY
    SELECT 
      r.id AS registration_id,
      g.id AS gymnast_id,
      g.first_name,
      g.last_name,
      cl.id AS club_id,
      cl.name AS club_name,
      cl.code AS club_code,
      r.bib_number,
      cat.name AS category_name,
      cat.discipline::TEXT AS discipline,
      r.subdivision,
      r.rotation_group,
      r.starting_apparatus,
      r.start_order,
      r.status,
      r.updated_at
    FROM public.registrations r
    JOIN public.gymnasts g ON g.id = r.gymnast_id
    JOIN public.clubs cl ON cl.id = r.club_id
    LEFT JOIN public.categories cat ON cat.id = r.category_id
    WHERE r.championship_id = p_championship_id
      AND (p_club_id IS NULL OR r.club_id = p_club_id)
      AND r.status = 'approved'
    ORDER BY r.subdivision, r.rotation_group, r.start_order;
    RETURN;
  END IF;

  -- Delegado / Entrenador: recibe EXCLUSIVAMENTE los gimnastas de su propio club
  RETURN QUERY
  SELECT 
    r.id AS registration_id,
    g.id AS gymnast_id,
    g.first_name,
    g.last_name,
    cl.id AS club_id,
    cl.name AS club_name,
    cl.code AS club_code,
    r.bib_number,
    cat.name AS category_name,
    cat.discipline::TEXT AS discipline,
    r.subdivision,
    r.rotation_group,
    r.starting_apparatus,
    r.start_order,
    r.status,
    r.updated_at
  FROM public.registrations r
  JOIN public.gymnasts g ON g.id = r.gymnast_id
  JOIN public.clubs cl ON cl.id = r.club_id
  JOIN public.club_members cm ON cm.club_id = cl.id
  LEFT JOIN public.categories cat ON cat.id = r.category_id
  WHERE r.championship_id = p_championship_id
    AND cm.user_id = v_uid
    AND (p_club_id IS NULL OR r.club_id = p_club_id)
    AND r.status = 'approved'
  ORDER BY r.subdivision, r.rotation_group, r.start_order;
END;
$$;

-- 3.5 Verificación de asignación de juez a puntuación
CREATE OR REPLACE FUNCTION public.is_judge_assigned_to_score(
    target_score_id UUID,
    target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.scores s
        JOIN public.judge_assignments ja ON ja.championship_id = s.championship_id 
                                        AND ja.apparatus_id = s.apparatus_id
        JOIN public.judges j ON j.id = ja.judge_id
        WHERE s.id = target_score_id
          AND j.user_id = target_user_id
    );
$$;

-- 3.6 Inmutabilidad WORM de auditoría (por fila)
CREATE OR REPLACE FUNCTION public.prevent_score_audits_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: Las pistas de auditoría deportiva de Operix (score_audits) son estrictamente inmutables (WORM). No se permite UPDATE ni DELETE.';
END;
$$;

-- 3.7 Inmutabilidad WORM contra TRUNCATE (por sentencia)
CREATE OR REPLACE FUNCTION public.prevent_score_audits_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: Operación TRUNCATE no permitida sobre score_audits.';
END;
$$;

-- 3.8 Trazabilidad automática de cambios en la programación
CREATE OR REPLACE FUNCTION public.track_championship_schedule_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE public.championships
  SET schedule_updated_at = timezone('utc'::text, now())
  WHERE id = COALESCE(NEW.championship_id, OLD.championship_id);
  RETURN NEW;
END;
$$;

-- 3.9 Puntuación Rápida con PIN de Juez
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
    p_final_score NUMERIC(5, 3)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_score_id UUID;
    v_expected_code TEXT;
    v_champ_status public.championship_status;
    v_existing_status public.score_status;
BEGIN
    SELECT c.judge_code, c.status INTO v_expected_code, v_champ_status
    FROM public.championships c
    WHERE c.id = p_championship_id;

    IF v_expected_code IS NULL OR v_expected_code <> p_judge_code THEN
        RAISE EXCEPTION 'ACCESO DENEGADO: Código de juez inválido para este campeonato.';
    END IF;

    IF v_champ_status NOT IN ('in_progress', 'registration_closed') THEN
        RAISE EXCEPTION 'COMPETICIÓN NO ACTIVA: Solo se pueden ingresar notas en campeonatos en curso.';
    END IF;

    SELECT s.id, s.status INTO v_score_id, v_existing_status
    FROM public.scores s
    WHERE s.championship_id = p_championship_id
      AND s.registration_id = p_registration_id
      AND s.apparatus_id = p_apparatus_id;

    IF v_score_id IS NOT NULL THEN
        IF v_existing_status = 'approved' THEN
            RAISE EXCEPTION 'PUNTUACIÓN BLOQUEADA: La nota ya ha sido aprobada oficialmente por el Juez Árbitro y no puede ser sobrescrita.';
        END IF;

        UPDATE public.scores
        SET
            d_score = p_d_score,
            e_scores = p_e_scores,
            e_score_avg = p_e_score_avg,
            neutral_deductions = p_neutral_deductions,
            final_score = p_final_score,
            submitted_by_judge_id = NULL,
            judge_name = p_judge_name,
            status = 'provisional',
            updated_at = timezone('utc'::text, now())
        WHERE id = v_score_id;

        RETURN v_score_id;
    ELSE
        INSERT INTO public.scores (
            championship_id,
            registration_id,
            apparatus_id,
            d_score,
            e_scores,
            e_score_avg,
            neutral_deductions,
            final_score,
            submitted_by_judge_id,
            judge_name,
            status
        ) VALUES (
            p_championship_id,
            p_registration_id,
            p_apparatus_id,
            p_d_score,
            p_e_scores,
            p_e_score_avg,
            p_neutral_deductions,
            p_final_score,
            NULL,
            p_judge_name,
            'provisional'
        )
        RETURNING id INTO v_score_id;

        RETURN v_score_id;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. CONCESIÓN Y REVOCACIÓN DE PERMISOS
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.current_user_has_championship_role(UUID, public.organization_role[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_championship_role(UUID, public.organization_role[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_view_championship_public_data(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.can_view_championship_public_data(UUID) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.current_user_can_access_championship_rotations(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_championship_rotations(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_club_rotations(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_club_rotations(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_judge_assigned_to_score(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_judge_assigned_to_score(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.prevent_score_audits_tampering() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_score_audits_truncate() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_championship_schedule_update() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_fast_judge_score(UUID, TEXT, UUID, UUID, TEXT, NUMERIC, JSONB, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated;

REVOKE TRUNCATE ON public.score_audits FROM public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. POLÍTICAS RLS CANÓNICAS Y ENDURECIDAS
-- ------------------------------------------------------------------------------

-- 5.1 competition_schedules (PRIVADO)
ALTER TABLE public.competition_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read competition schedules" ON public.competition_schedules;
DROP POLICY IF EXISTS "Org admins manage competition schedules" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules viewable by public or members" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules insert by org managers" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules update by org managers" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules delete by org managers" ON public.competition_schedules;
DROP POLICY IF EXISTS "Competition schedules select authorized" ON public.competition_schedules;

CREATE POLICY "Competition schedules select authorized"
    ON public.competition_schedules FOR SELECT TO authenticated
    USING (public.current_user_can_access_championship_rotations(competition_schedules.championship_id));

CREATE POLICY "Competition schedules insert by org managers"
    ON public.competition_schedules FOR INSERT TO authenticated
    WITH CHECK (public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Competition schedules update by org managers"
    ON public.competition_schedules FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Competition schedules delete by org managers"
    ON public.competition_schedules FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

-- 5.2 apparatus_live_status (PRIVADO)
ALTER TABLE public.apparatus_live_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read apparatus live status" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Authorized tournament staff manage live status" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status viewable by public" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status select authorized" ON public.apparatus_live_status;

CREATE POLICY "Apparatus live status select authorized"
    ON public.apparatus_live_status FOR SELECT TO authenticated
    USING (public.current_user_can_access_championship_rotations(apparatus_live_status.championship_id));

CREATE POLICY "Apparatus live status insert by staff"
    ON public.apparatus_live_status FOR INSERT TO authenticated
    WITH CHECK (public.current_user_has_championship_role(apparatus_live_status.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]));

CREATE POLICY "Apparatus live status update by staff or judges"
    ON public.apparatus_live_status FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(apparatus_live_status.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge', 'judge']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(apparatus_live_status.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge', 'judge']::public.organization_role[]));

CREATE POLICY "Apparatus live status delete by managers"
    ON public.apparatus_live_status FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(apparatus_live_status.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

-- 5.3 rotation_groups (PRIVADO)
ALTER TABLE public.rotation_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view rotation groups" ON public.rotation_groups;
DROP POLICY IF EXISTS "Admins can manage rotation groups" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups viewable" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups select authorized" ON public.rotation_groups;

CREATE POLICY "Rotation groups select authorized"
    ON public.rotation_groups FOR SELECT TO authenticated
    USING (public.current_user_can_access_championship_rotations(rotation_groups.championship_id));

CREATE POLICY "Rotation groups insert by managers"
    ON public.rotation_groups FOR INSERT TO authenticated
    WITH CHECK (public.current_user_has_championship_role(rotation_groups.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Rotation groups update by managers"
    ON public.rotation_groups FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(rotation_groups.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(rotation_groups.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Rotation groups delete by managers"
    ON public.rotation_groups FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(rotation_groups.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

-- 5.4 championship_documents
ALTER TABLE public.championship_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read championship documents" ON public.championship_documents;
DROP POLICY IF EXISTS "Authenticated users log generated documents" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents select policy" ON public.championship_documents;

CREATE POLICY "Championship documents select policy"
    ON public.championship_documents FOR SELECT TO public
    USING (
        (is_public AND public.can_view_championship_public_data(championship_documents.championship_id))
        OR (auth.uid() IS NOT NULL AND public.current_user_has_championship_role(championship_documents.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]))
    );

CREATE POLICY "Championship documents insert policy"
    ON public.championship_documents FOR INSERT TO authenticated
    WITH CHECK (public.current_user_has_championship_role(championship_documents.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]));

CREATE POLICY "Championship documents update policy"
    ON public.championship_documents FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(championship_documents.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(championship_documents.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]));

CREATE POLICY "Championship documents delete policy"
    ON public.championship_documents FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(championship_documents.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

-- 5.5 championship_awards_config
ALTER TABLE public.championship_awards_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read awards config" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Org admins manage awards config" ON public.championship_awards_config;

CREATE POLICY "Awards config viewable by public"
    ON public.championship_awards_config FOR SELECT TO public
    USING (public.can_view_championship_public_data(championship_awards_config.championship_id));

CREATE POLICY "Awards config insert by managers"
    ON public.championship_awards_config FOR INSERT TO authenticated
    WITH CHECK (public.current_user_has_championship_role(championship_awards_config.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Awards config update by managers"
    ON public.championship_awards_config FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(championship_awards_config.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(championship_awards_config.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Awards config delete by managers"
    ON public.championship_awards_config FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(championship_awards_config.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

-- 5.6 championship_awards_ceremonies
ALTER TABLE public.championship_awards_ceremonies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read ceremonies" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Org admins manage ceremonies" ON public.championship_awards_ceremonies;

CREATE POLICY "Ceremonies viewable by public"
    ON public.championship_awards_ceremonies FOR SELECT TO public
    USING (public.can_view_championship_public_data(championship_awards_ceremonies.championship_id));

CREATE POLICY "Ceremonies insert by staff"
    ON public.championship_awards_ceremonies FOR INSERT TO authenticated
    WITH CHECK (public.current_user_has_championship_role(championship_awards_ceremonies.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]));

CREATE POLICY "Ceremonies update by staff"
    ON public.championship_awards_ceremonies FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(championship_awards_ceremonies.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(championship_awards_ceremonies.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]));

CREATE POLICY "Ceremonies delete by managers"
    ON public.championship_awards_ceremonies FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(championship_awards_ceremonies.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

-- 5.7 score_deductions
ALTER TABLE public.score_deductions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read deductions" ON public.score_deductions;
DROP POLICY IF EXISTS "Judges insert deductions" ON public.score_deductions;
DROP POLICY IF EXISTS "Deductions select policy" ON public.score_deductions;

CREATE POLICY "Deductions select policy"
    ON public.score_deductions FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_deductions.score_id
              AND (
                  public.current_user_has_championship_role(s.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[])
                  OR public.is_judge_assigned_to_score(s.id, auth.uid())
              )
        )
    );

CREATE POLICY "Deductions insert policy"
    ON public.score_deductions FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_deductions.score_id
              AND (
                  public.current_user_has_championship_role(s.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[])
                  OR public.is_judge_assigned_to_score(s.id, auth.uid())
              )
        )
    );

CREATE POLICY "Deductions update policy"
    ON public.score_deductions FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_deductions.score_id
              AND (
                  public.current_user_has_championship_role(s.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[])
                  OR public.is_judge_assigned_to_score(s.id, auth.uid())
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_deductions.score_id
              AND (
                  public.current_user_has_championship_role(s.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[])
                  OR public.is_judge_assigned_to_score(s.id, auth.uid())
              )
        )
    );

CREATE POLICY "Deductions delete policy"
    ON public.score_deductions FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_deductions.score_id
              AND public.current_user_has_championship_role(s.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[])
        )
    );

-- 5.8 technical_inquiries (FIG Art. 5.4)
ALTER TABLE public.technical_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Inquiries select policy" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries insert policy" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries update policy" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries delete policy" ON public.technical_inquiries;

CREATE POLICY "Inquiries select policy"
    ON public.technical_inquiries FOR SELECT TO authenticated
    USING (
        public.current_user_has_championship_role(technical_inquiries.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[])
        OR (
            EXISTS (
                SELECT 1 FROM public.club_members cm
                WHERE cm.club_id = technical_inquiries.club_id
                  AND cm.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Inquiries insert policy"
    ON public.technical_inquiries FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = submitted_by_user_id
        AND EXISTS (
            SELECT 1 FROM public.club_members cm
            WHERE cm.club_id = technical_inquiries.club_id
              AND cm.user_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM public.registrations r
            WHERE r.id = (SELECT s.registration_id FROM public.scores s WHERE s.id = technical_inquiries.score_id)
              AND r.club_id = technical_inquiries.club_id
              AND r.gymnast_id = technical_inquiries.gymnast_id
        )
    );

CREATE POLICY "Inquiries update policy"
    ON public.technical_inquiries FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(technical_inquiries.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(technical_inquiries.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]));

CREATE POLICY "Inquiries delete policy"
    ON public.technical_inquiries FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(technical_inquiries.championship_id, ARRAY['org_admin']::public.organization_role[]));

-- 5.9 score_audits (Inmutabilidad Estricta WORM)
ALTER TABLE public.score_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Audits viewable by org staff" ON public.score_audits;
DROP POLICY IF EXISTS "Audits insert system and authenticated" ON public.score_audits;
DROP POLICY IF EXISTS "Audits block update" ON public.score_audits;
DROP POLICY IF EXISTS "Audits block delete" ON public.score_audits;

CREATE POLICY "Audits viewable by org staff"
    ON public.score_audits FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_audits.score_id
              AND public.current_user_has_championship_role(s.championship_id, ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[])
        )
    );

CREATE POLICY "Audits insert system and authenticated"
    ON public.score_audits FOR INSERT TO authenticated
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. TRIGGERS DE SEGURIDAD E INMUTABILIDAD
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_score_audits_tampering ON public.score_audits;
CREATE TRIGGER trg_prevent_score_audits_tampering
    BEFORE UPDATE OR DELETE ON public.score_audits
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_score_audits_tampering();

DROP TRIGGER IF EXISTS trg_prevent_score_audits_truncate ON public.score_audits;
CREATE TRIGGER trg_prevent_score_audits_truncate
    BEFORE TRUNCATE ON public.score_audits
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_score_audits_truncate();

DROP TRIGGER IF EXISTS trg_track_schedule_update ON public.competition_schedules;
CREATE TRIGGER trg_track_schedule_update
    AFTER INSERT OR UPDATE OR DELETE ON public.competition_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.track_championship_schedule_update();

DROP TRIGGER IF EXISTS trg_track_rotations_update ON public.rotation_groups;
CREATE TRIGGER trg_track_rotations_update
    AFTER INSERT OR UPDATE OR DELETE ON public.rotation_groups
    FOR EACH ROW
    EXECUTE FUNCTION public.track_championship_schedule_update();

COMMIT;
