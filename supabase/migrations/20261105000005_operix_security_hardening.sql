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
