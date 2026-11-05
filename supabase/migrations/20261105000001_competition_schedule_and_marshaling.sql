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
