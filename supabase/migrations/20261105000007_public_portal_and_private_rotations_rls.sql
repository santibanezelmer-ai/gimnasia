-- ==============================================================================
-- Migration: 20261105000007_public_portal_and_private_rotations_rls.sql
-- Description: Separación estricta de portal público y acceso privado a rotaciones.
--              1. Protege competition_schedules, rotation_groups y apparatus_live_status
--                 contra consultas públicas o de usuarios sin autorización.
--              2. Aislamiento club-a-club en rotaciones (Club A no ve rotaciones de Club B).
--              3. Permite a la organización configurar qué datos son públicos (portal Kluv-style).
--              4. Provee RPC seguro get_my_club_rotations(target_championship_id, target_club_id).
--              5. search_path = pg_catalog estricto, GRANT/REVOKE explícitos y sin escalamiento.
--
-- Desarrollado por Comercial Hels SpA para Operix Gymnastics.
-- ==============================================================================

-- 1. Asegurar columnas en registrations y championships
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS subdivision TEXT,
  ADD COLUMN IF NOT EXISTS starting_apparatus TEXT,
  ADD COLUMN IF NOT EXISTS start_order INT;

ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS public_portal_settings JSONB NOT NULL 
  DEFAULT '{"show_participating_clubs": true, "show_categories": true, "show_published_results": true, "show_medal_tally": true, "show_venue_details": true}'::jsonb;

ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS schedule_updated_at TIMESTAMPTZ 
  DEFAULT timezone('utc'::text, now());

ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS schedule_change_notices JSONB NOT NULL
  DEFAULT '[]'::jsonb;

-- 2. Función auxiliar SECURITY DEFINER: Verifica si un usuario es delegado/entrenador acreditado
-- de un club registrado en el campeonato (o de un club específico) o juez asignado
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

  -- 1. Plataforma SuperAdmin
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid AND platform_role = 'platform_admin'
  ) INTO v_is_platform_admin;

  IF v_is_platform_admin THEN
    RETURN TRUE;
  END IF;

  -- 2. Staff de la Organización del Campeonato (org_admin, competition_manager, head_judge)
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

  -- 3. Jueces asignados al campeonato (verificación a través de public.judges)
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
    -- Verificación específica para un club en particular
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
    -- Verificación general: el usuario pertenece a cualquier club acreditado en el campeonato
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

COMMENT ON FUNCTION public.current_user_can_access_championship_rotations(UUID, UUID) IS 
'Verifica si el usuario autenticado tiene autorización para ver las rotaciones y programación de un campeonato o club.';

REVOKE EXECUTE ON FUNCTION public.current_user_can_access_championship_rotations(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_user_can_access_championship_rotations(UUID, UUID) TO authenticated;

-- 3. Revocar políticas públicas y aplicar RLS estricto sobre competition_schedules
ALTER TABLE public.competition_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read competition schedules" ON public.competition_schedules;
DROP POLICY IF EXISTS "Schedules viewable by public or members" ON public.competition_schedules;
DROP POLICY IF EXISTS "Competition schedules select authorized" ON public.competition_schedules;
DROP POLICY IF EXISTS "Competition schedules insert by org managers" ON public.competition_schedules;
DROP POLICY IF EXISTS "Competition schedules update by org managers" ON public.competition_schedules;
DROP POLICY IF EXISTS "Competition schedules delete by org managers" ON public.competition_schedules;

CREATE POLICY "Competition schedules select authorized"
  ON public.competition_schedules
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_can_access_championship_rotations(competition_schedules.championship_id)
  );

CREATE POLICY "Competition schedules insert by org managers"
  ON public.competition_schedules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[])
  );

CREATE POLICY "Competition schedules update by org managers"
  ON public.competition_schedules
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[])
  )
  WITH CHECK (
    public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[])
  );

CREATE POLICY "Competition schedules delete by org managers"
  ON public.competition_schedules
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_has_championship_role(competition_schedules.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[])
  );

-- 4. Revocar políticas públicas y aplicar RLS estricto sobre rotation_groups
ALTER TABLE public.rotation_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view rotation groups" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups viewable" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups select authorized" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups insert by managers" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups update by managers" ON public.rotation_groups;
DROP POLICY IF EXISTS "Rotation groups delete by managers" ON public.rotation_groups;

CREATE POLICY "Rotation groups select authorized"
  ON public.rotation_groups
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_can_access_championship_rotations(rotation_groups.championship_id)
  );

CREATE POLICY "Rotation groups insert by managers"
  ON public.rotation_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_has_championship_role(rotation_groups.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[])
  );

CREATE POLICY "Rotation groups update by managers"
  ON public.rotation_groups
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_has_championship_role(rotation_groups.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[])
  )
  WITH CHECK (
    public.current_user_has_championship_role(rotation_groups.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[])
  );

CREATE POLICY "Rotation groups delete by managers"
  ON public.rotation_groups
  FOR DELETE
  TO authenticated
  USING (
    public.current_user_has_championship_role(rotation_groups.championship_id, ARRAY['org_admin', 'competition_manager']::public.organization_role[])
  );

-- 5. Revocar políticas públicas y aplicar RLS estricto sobre apparatus_live_status
ALTER TABLE public.apparatus_live_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read apparatus live status" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status viewable by public" ON public.apparatus_live_status;
DROP POLICY IF EXISTS "Apparatus live status select authorized" ON public.apparatus_live_status;

CREATE POLICY "Apparatus live status select authorized"
  ON public.apparatus_live_status
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_can_access_championship_rotations(apparatus_live_status.championship_id)
  );

-- 6. RPC: Consulta privada y segura de rotaciones del club del usuario solicitante
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

  -- Comprobar si el usuario tiene permiso general de organizador o superadmin
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND platform_role = 'platform_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.championships c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = p_championship_id AND om.user_id = v_uid AND om.role IN ('org_admin', 'competition_manager', 'head_judge')
  ) THEN
    -- Organizador: recibe todas las rotaciones del torneo o filtra por p_club_id si se especificó
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
  -- Si se pasa p_club_id, verifica que el usuario pertenezca específicamente a ese club
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

COMMENT ON FUNCTION public.get_my_club_rotations(UUID, UUID) IS
'Retorna exclusivamente las rotaciones, gimnastas y orden de salida del club al que pertenece el usuario autenticado.';

REVOKE EXECUTE ON FUNCTION public.get_my_club_rotations(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_club_rotations(UUID, UUID) TO authenticated;

-- 7. Trigger para actualizar schedule_updated_at cuando la organización cambie rotaciones o programación
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

REVOKE EXECUTE ON FUNCTION public.track_championship_schedule_update() FROM public, anon, authenticated;

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
