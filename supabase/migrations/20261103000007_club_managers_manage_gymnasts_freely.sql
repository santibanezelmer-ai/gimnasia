-- ==============================================================================
-- Migration: 20261103000007_club_managers_manage_gymnasts_freely.sql
-- Description: Allows club_manager role to freely create, edit and register their
--              own gymnasts without needing federation admin intervention.
-- ==============================================================================

-- 1. Ensure club_members entry for demo club manager
INSERT INTO public.club_members (club_id, user_id, role)
SELECT 
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID,
  p.id,
  'manager'
FROM public.profiles p
WHERE p.email = 'club@operix.app'
ON CONFLICT (club_id, user_id) DO NOTHING;

-- 2. Update RLS policy on public.gymnasts to explicitly empower club_manager
DROP POLICY IF EXISTS "Club members or org managers can manage gymnasts" ON public.gymnasts;

CREATE POLICY "Club managers and members can manage gymnasts"
  ON public.gymnasts
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_belongs_to_club(club_id)
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY[
        'org_admin'::public.organization_role,
        'competition_manager'::public.organization_role,
        'club_manager'::public.organization_role
      ]
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_belongs_to_club(club_id)
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY[
        'org_admin'::public.organization_role,
        'competition_manager'::public.organization_role,
        'club_manager'::public.organization_role
      ]
    )
  );

-- 3. Update RLS policy on public.registrations to empower club_manager
DROP POLICY IF EXISTS "Club managers can manage registrations for their club" ON public.registrations;

CREATE POLICY "Club managers can manage registrations for their club"
  ON public.registrations
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_belongs_to_club(club_id)
    OR public.current_user_has_org_role(
      (SELECT c.organization_id FROM public.championships c WHERE c.id = registrations.championship_id),
      ARRAY[
        'org_admin'::public.organization_role,
        'competition_manager'::public.organization_role,
        'club_manager'::public.organization_role
      ]
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_belongs_to_club(club_id)
    OR public.current_user_has_org_role(
      (SELECT c.organization_id FROM public.championships c WHERE c.id = registrations.championship_id),
      ARRAY[
        'org_admin'::public.organization_role,
        'competition_manager'::public.organization_role,
        'club_manager'::public.organization_role
      ]
    )
  );
