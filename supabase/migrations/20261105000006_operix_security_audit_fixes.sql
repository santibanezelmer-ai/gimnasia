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
