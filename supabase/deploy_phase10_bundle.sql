-- ==============================================================================
-- OPERIX GYMNASTICS — BUNDLE CANÓNICO DE DESPLIEGUE CONTROLADO (FASES 8, 9, 10, 10.1, 10.2)
-- Desarrollado por Comercial Hels SpA
-- Fecha: 5 de noviembre de 2026
--
-- CARACTERÍSTICAS DEL BUNDLE:
-- 1. Transaccionalidad Atómica (BEGIN ... COMMIT): ante cualquier error, Postgres
--    realiza rollback automático sin dejar instalaciones parciales corruptas.
-- 2. Compatibilidad 100% con el esquema real de producción:
--    - championships.visibility (enum public.championship_visibility)
--    - championships.status (enum public.championship_status)
--    - scores.submitted_by_judge_id
--    - technical_inquiries.submitted_by_user_id
--    - championship_documents.document_type
-- 3. Aislamiento Multi-Tenant estricto (cero políticas USING(true) ni FOR ALL permisivas).
-- 4. Protección Deportiva FIG Art. 5.4 e Inmutabilidad de Auditoría WORM en score_audits.
-- 5. No destructivo: NO CONTIENE ningún DROP TABLE CASCADE ni sentencias que eliminen datos.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. CREACIÓN DE TABLAS DE INFRAESTRUCTURA DE COMPETENCIA (FASE 8, 9, 10)
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

-- 1.2 Estado de Aparatos en Vivo (Semáforo y Marshaling)
CREATE TABLE IF NOT EXISTS public.apparatus_live_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    apparatus_id UUID NOT NULL REFERENCES public.apparatuses(id) ON DELETE CASCADE,
    current_gymnast_id UUID REFERENCES public.gymnasts(id) ON DELETE SET NULL,
    current_registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
    current_attempt INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'idle', -- 'idle' | 'warmup' | 'competing' | 'scoring' | 'blocked'
    updated_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_champ_apparatus_live UNIQUE (championship_id, apparatus_id)
);

-- 1.3 Grupos de Rotación
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

-- 1.4 Operix Reports: Documentación Oficial
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

-- 1.5 Operix Awards: Configuración de Premiación
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

-- 1.7 Deducciones Detalladas de Nota (Panel de Jueces)
CREATE TABLE IF NOT EXISTS public.score_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score_id UUID NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
    judge_id UUID REFERENCES public.judges(id) ON DELETE SET NULL,
    deduction_type TEXT NOT NULL, -- 'execution_fall', 'out_of_bounds', 'time_violation', 'landing_step', 'neutral'
    points NUMERIC(5, 3) NOT NULL, -- e.g. 0.100, 0.300, 0.500, 1.000
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.8 Reclamos Técnicos (FIG Art. 5.4)
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

-- ------------------------------------------------------------------------------
-- 2. ÍNDICES DE ALTO RENDIMIENTO
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_comp_schedules_champ ON public.competition_schedules(championship_id);
CREATE INDEX IF NOT EXISTS idx_apparatus_live_champ ON public.apparatus_live_status(championship_id);
CREATE INDEX IF NOT EXISTS idx_rotation_groups_champ ON public.rotation_groups(championship_id);
CREATE INDEX IF NOT EXISTS idx_champ_documents_champ ON public.championship_documents(championship_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_champ_documents_type ON public.championship_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_awards_config_champ ON public.championship_awards_config(championship_id);
CREATE INDEX IF NOT EXISTS idx_awards_ceremonies_champ_status ON public.championship_awards_ceremonies(championship_id, status);
CREATE INDEX IF NOT EXISTS idx_score_deductions_score ON public.score_deductions(score_id);
CREATE INDEX IF NOT EXISTS idx_score_deductions_type ON public.score_deductions(deduction_type);
CREATE INDEX IF NOT EXISTS idx_inquiries_champ ON public.technical_inquiries(championship_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_score ON public.technical_inquiries(score_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.technical_inquiries(status);

-- ------------------------------------------------------------------------------
-- 3. FUNCIONES AUXILIARES SECURITY DEFINER (CANÓNICAS CORREGIDAS)
-- ------------------------------------------------------------------------------

-- 3.1 Validador de roles en campeonato
CREATE OR REPLACE FUNCTION public.current_user_has_championship_role(
    target_championship_id UUID,
    required_roles public.organization_role[]
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
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

REVOKE EXECUTE ON FUNCTION public.current_user_has_championship_role(UUID, public.organization_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_championship_role(UUID, public.organization_role[]) TO authenticated;

-- 3.2 Validador de visibilidad pública de campeonato (esquema real: visibility y status)
CREATE OR REPLACE FUNCTION public.can_view_championship_public_data(
    target_championship_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
    v_champ RECORD;
BEGIN
    IF target_championship_id IS NULL THEN
        RETURN false;
    END IF;

    SELECT visibility, status, organization_id INTO v_champ
    FROM public.championships
    WHERE id = target_championship_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Acceso público abierto si visibility = 'public' y el torneo está activo o completado
    IF v_champ.visibility = 'public' AND v_champ.status IN ('registration_open', 'registration_closed', 'in_progress', 'completed') THEN
        RETURN true;
    END IF;

    -- Si es privado o borrador, exige autenticación verificada
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    IF public.is_platform_admin(auth.uid()) THEN
        RETURN true;
    END IF;

    -- Miembro de la organización
    IF public.current_user_has_org_role(
        v_champ.organization_id, 
        ARRAY['org_admin', 'competition_manager', 'head_judge', 'judge', 'club_manager', 'coach', 'viewer']::public.organization_role[]
    ) THEN
        RETURN true;
    END IF;

    -- Miembro de un club inscrito en este torneo
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

REVOKE EXECUTE ON FUNCTION public.can_view_championship_public_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_championship_public_data(UUID) TO anon, authenticated;

-- 3.3 Validador de asignación de juez a nota (con submitted_by_judge_id y bloqueo de nota aprobada)
CREATE OR REPLACE FUNCTION public.is_judge_assigned_to_score(
    target_score_id UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
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

    SELECT s.championship_id, s.apparatus_id, s.submitted_by_judge_id, s.status, j.user_id AS judge_user_id
    INTO v_score
    FROM public.scores s
    LEFT JOIN public.judges j ON j.id = s.submitted_by_judge_id
    WHERE s.id = target_score_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- Si la nota ya fue aprobada oficialmente, un juez regular no puede alterarla
    IF v_score.status = 'approved' THEN
        RETURN public.current_user_has_championship_role(
            v_score.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        );
    END IF;

    -- Si el usuario es el juez emisor
    IF v_score.judge_user_id = auth.uid() THEN
        RETURN true;
    END IF;

    -- Si está asignado oficialmente al aparato
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

REVOKE EXECUTE ON FUNCTION public.is_judge_assigned_to_score(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_judge_assigned_to_score(UUID) TO authenticated;

-- 3.4 Inmutabilidad Estricta de score_audits (Trigger Anti-Tampering WORM)
CREATE OR REPLACE FUNCTION public.prevent_score_audits_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
    RAISE EXCEPTION 'OPERIX_SECURITY_VIOLATION: La tabla score_audits es estrictamente inmutable (append-only). Las operaciones de UPDATE y DELETE están prohibidas por normativa reglamentaria.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_score_audits_tampering ON public.score_audits;
CREATE TRIGGER trg_prevent_score_audits_tampering
    BEFORE UPDATE OR DELETE ON public.score_audits
    FOR EACH ROW EXECUTE FUNCTION public.prevent_score_audits_tampering();

REVOKE EXECUTE ON FUNCTION public.prevent_score_audits_tampering() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_score_audits_tampering() TO authenticated;


-- 3.4.1 Inmutabilidad Estricta de score_audits contra TRUNCATE (Statement-level)
CREATE OR REPLACE FUNCTION public.prevent_score_audits_truncate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $
BEGIN
    RAISE EXCEPTION 'OPERIX_SECURITY_VIOLATION: La tabla score_audits no puede ser vaciada (TRUNCATE prohibido por normativa reglamentaria).';
END;
$;

DROP TRIGGER IF EXISTS trg_prevent_score_audits_truncate ON public.score_audits;
CREATE TRIGGER trg_prevent_score_audits_truncate
    BEFORE TRUNCATE ON public.score_audits
    FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_score_audits_truncate();

REVOKE EXECUTE ON FUNCTION public.prevent_score_audits_truncate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_score_audits_truncate() TO authenticated;

REVOKE UPDATE, DELETE, TRUNCATE ON public.score_audits FROM public, anon, authenticated;
GRANT SELECT, INSERT ON public.score_audits TO authenticated;

-- 3.5 Blindaje de submit_fast_judge_score contra modificación de notas aprobadas
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
SET search_path = pg_catalog
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

  SELECT judge_code, status INTO v_expected_code, v_champ_status
  FROM public.championships
  WHERE id = p_championship_id;

  IF v_expected_code IS NULL OR TRIM(UPPER(v_expected_code)) <> TRIM(UPPER(p_judge_code)) THEN
    RAISE EXCEPTION 'Código de juez inválido para este campeonato.';
  END IF;

  IF v_champ_status NOT IN ('in_progress', 'registration_closed') THEN
    RAISE EXCEPTION 'El campeonato no se encuentra en estado activo para juzgamiento en vivo.';
  END IF;

  SELECT status INTO v_existing_status
  FROM public.scores
  WHERE registration_id = p_registration_id
    AND apparatus_id = p_apparatus_id
    AND attempt_number = v_attempt;

  IF v_existing_status = 'approved' THEN
    RAISE EXCEPTION 'OPERIX_SECURITY_VIOLATION: La nota para este gimnasta ya ha sido aprobada oficialmente por el Juez Árbitro y no puede ser modificada desde la terminal rápida.';
  END IF;

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

-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS RLS CANÓNICAS Y ENDURECIDAS
-- ------------------------------------------------------------------------------

-- 4.1 competition_schedules
ALTER TABLE public.competition_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read competition schedules" ON public.competition_schedules;
DROP POLICY IF EXISTS "Org admins manage competition schedules" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules viewable by public or members" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules insert by org managers" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules update by org managers" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules delete by org managers" ON public.competition_schedules;

CREATE POLICY "Schedules viewable by public or members"
    ON public.competition_schedules FOR SELECT TO public
    USING (public.can_view_championship_public_data(competition_schedules.championship_id));

CREATE POLICY "Schedules insert by org managers"
    ON public.competition_schedules FOR INSERT TO authenticated
    WITH CHECK (public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Schedules update by org managers"
    ON public.competition_schedules FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Schedules delete by org managers"
    ON public.competition_schedules FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

-- 4.2 apparatus_live_status
ALTER TABLE public.apparatus_live_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read apparatus live status" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Authorized tournament staff manage live status" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status viewable by public" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status insert by staff" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status update by staff or judges" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status delete by managers" ON public.apparatus_live_status;

CREATE POLICY "Apparatus live status viewable by public"
    ON public.apparatus_live_status FOR SELECT TO public
    USING (public.can_view_championship_public_data(apparatus_live_status.championship_id));

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

-- 4.3 rotation_groups
ALTER TABLE public.rotation_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view rotation groups" ON public.rotation_groups;
DROP POLICY IF EXISTS "Admins can manage rotation groups" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups viewable" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups insert by managers" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups update by managers" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups delete by managers" ON public.rotation_groups;

CREATE POLICY "Rotation groups viewable"
    ON public.rotation_groups FOR SELECT TO public
    USING (public.can_view_championship_public_data(rotation_groups.championship_id));

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

-- 4.4 championship_documents
ALTER TABLE public.championship_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read championship documents" ON public.championship_documents;
DROP POLICY IF EXISTS "Authenticated users log generated documents" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents select policy" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents insert policy" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents update policy" ON public.championship_documents;
DROP POLICY IF EXISTS "Championship documents delete policy" ON public.championship_documents;

CREATE POLICY "Championship documents select policy"
    ON public.championship_documents FOR SELECT TO public
    USING (
        (
            championship_documents.is_public = true
            AND championship_documents.document_type NOT IN ('official_minutes', 'judging_sheets')
            AND public.can_view_championship_public_data(championship_documents.championship_id)
        )
        OR (
            auth.uid() IS NOT NULL
            AND public.current_user_has_championship_role(
                championship_documents.championship_id,
                ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
            )
        )
    );

CREATE POLICY "Championship documents insert policy"
    ON public.championship_documents FOR INSERT TO authenticated
    WITH CHECK (
        public.current_user_has_championship_role(
            championship_documents.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
    );

CREATE POLICY "Championship documents update policy"
    ON public.championship_documents FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(championship_documents.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(championship_documents.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Championship documents delete policy"
    ON public.championship_documents FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(championship_documents.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

-- 4.5 championship_awards_config
ALTER TABLE public.championship_awards_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public and members can read awards config" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Org admins can manage awards config" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Awards config select policy" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Awards config insert policy" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Awards config update policy" ON public.championship_awards_config;
DROP POLICY IF EXISTS "Awards config delete policy" ON public.championship_awards_config;

CREATE POLICY "Awards config select policy"
    ON public.championship_awards_config FOR SELECT TO public
    USING (public.can_view_championship_public_data(championship_awards_config.championship_id));

CREATE POLICY "Awards config insert policy"
    ON public.championship_awards_config FOR INSERT TO authenticated
    WITH CHECK (public.current_user_has_championship_role(championship_awards_config.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Awards config update policy"
    ON public.championship_awards_config FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(championship_awards_config.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(championship_awards_config.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Awards config delete policy"
    ON public.championship_awards_config FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(championship_awards_config.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

-- 4.6 championship_awards_ceremonies
ALTER TABLE public.championship_awards_ceremonies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public and members can read ceremonies" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Org admins and judges can manage ceremonies" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Awards ceremonies select policy" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Awards ceremonies insert policy" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Awards ceremonies update policy" ON public.championship_awards_ceremonies;
DROP POLICY IF EXISTS "Awards ceremonies delete policy" ON public.championship_awards_ceremonies;

CREATE POLICY "Awards ceremonies select policy"
    ON public.championship_awards_ceremonies FOR SELECT TO public
    USING (public.can_view_championship_public_data(championship_awards_ceremonies.championship_id));

CREATE POLICY "Awards ceremonies insert policy"
    ON public.championship_awards_ceremonies FOR INSERT TO authenticated
    WITH CHECK (public.current_user_has_championship_role(championship_awards_ceremonies.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Awards ceremonies update policy"
    ON public.championship_awards_ceremonies FOR UPDATE TO authenticated
    USING (public.current_user_has_championship_role(championship_awards_ceremonies.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]))
    WITH CHECK (public.current_user_has_championship_role(championship_awards_ceremonies.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

CREATE POLICY "Awards ceremonies delete policy"
    ON public.championship_awards_ceremonies FOR DELETE TO authenticated
    USING (public.current_user_has_championship_role(championship_awards_ceremonies.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[]));

-- 4.7 score_deductions
ALTER TABLE public.score_deductions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view official score deductions" ON public.score_deductions;
DROP POLICY IF EXISTS "Judges and admins can manage score deductions" ON public.score_deductions;
DROP POLICY IF EXISTS "Score deductions are viewable" ON public.score_deductions;
DROP POLICY IF EXISTS "Score deductions insert by assigned judge or staff" ON public.score_deductions;
DROP POLICY IF EXISTS "Score deductions update by judge or staff" ON public.score_deductions;
DROP POLICY IF EXISTS "Score deductions delete by staff" ON public.score_deductions;

CREATE POLICY "Score deductions are viewable"
    ON public.score_deductions FOR SELECT TO public
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

CREATE POLICY "Score deductions insert by assigned judge or staff"
    ON public.score_deductions FOR INSERT TO authenticated
    WITH CHECK (public.is_judge_assigned_to_score(score_deductions.score_id));

CREATE POLICY "Score deductions update by judge or staff"
    ON public.score_deductions FOR UPDATE TO authenticated
    USING (public.is_judge_assigned_to_score(score_deductions.score_id))
    WITH CHECK (public.is_judge_assigned_to_score(score_deductions.score_id));

CREATE POLICY "Score deductions delete by staff"
    ON public.score_deductions FOR DELETE TO authenticated
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

-- 4.8 technical_inquiries (FIG Art. 5.4)
ALTER TABLE public.technical_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members and admins can view inquiries" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Delegates can submit inquiries" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Head judges and admins can resolve inquiries" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries viewable by staff or submitter" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries submission by club delegates or staff" ON public.technical_inquiries;
DROP POLICY IF EXISTS "Inquiries resolution by head judges or admins" ON public.technical_inquiries;

CREATE POLICY "Inquiries viewable by staff or submitter"
    ON public.technical_inquiries FOR SELECT TO authenticated
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

CREATE POLICY "Inquiries submission by club delegates or staff"
    ON public.technical_inquiries FOR INSERT TO authenticated
    WITH CHECK (
        public.is_platform_admin(auth.uid())
        OR public.current_user_has_championship_role(
            technical_inquiries.championship_id,
            ARRAY['org_admin', 'competition_manager', 'head_judge']::public.organization_role[]
        )
        OR (
            technical_inquiries.submitted_by_user_id = auth.uid()
            AND technical_inquiries.club_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.club_members cm
                WHERE cm.club_id = technical_inquiries.club_id
                  AND cm.user_id = auth.uid()
            )
            AND EXISTS (
                SELECT 1 FROM public.registrations r
                WHERE r.championship_id = technical_inquiries.championship_id
                  AND r.club_id = technical_inquiries.club_id
            )
        )
    );

CREATE POLICY "Inquiries resolution by head judges or admins"
    ON public.technical_inquiries FOR UPDATE TO authenticated
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

-- 4.9 score_audits (Inmutable)
ALTER TABLE public.score_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Audits are readable by org admins and head judges" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits are viewable by org staff" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits insert by system or staff" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits select policy" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits insert policy" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits update policy" ON public.score_audits;
DROP POLICY IF EXISTS "Score audits delete policy" ON public.score_audits;

CREATE POLICY "Score audits select policy"
    ON public.score_audits FOR SELECT TO authenticated
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

CREATE POLICY "Score audits insert policy"
    ON public.score_audits FOR INSERT TO authenticated
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

COMMIT;
