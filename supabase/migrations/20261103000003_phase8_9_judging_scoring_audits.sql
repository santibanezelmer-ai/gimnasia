-- ==============================================================================
-- Migration: 20261103000003_phase8_9_judging_scoring_audits.sql
-- Description: Schema for Judges, Apparatus Assignments, Scores, Official Review,
--              and Immutable Score Audits with RLS enforcing Judge Scopes.
-- ==============================================================================

-- 1. Create Enums
CREATE TYPE public.judge_panel_role AS ENUM (
  'D1',   -- Head of D-Panel (Difficulty / Requirements / Connection)
  'D2',   -- Second D-Judge
  'E1',   -- Execution Judge 1
  'E2',   -- Execution Judge 2
  'E3',   -- Execution Judge 3
  'E4',   -- Execution Judge 4
  'E5',   -- Execution Judge 5
  'E6',   -- Execution Judge 6
  'LINE', -- Line Judge
  'TIME'  -- Time Judge
);

CREATE TYPE public.score_status AS ENUM (
  'draft',              -- Saved by judge, not submitted yet
  'submitted',          -- Submitted by panel, awaiting Head Judge approval
  'provisional',        -- Approved for live boards / provisional display
  'official_approved'   -- Signed off by Superior Jury / Head Judge
);

-- 2. Create Judges Table (Brevet and credentials)
CREATE TABLE IF NOT EXISTS public.judges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  brevet_level TEXT NOT NULL,            -- e.g. "FIG Brevet 1", "FIG Brevet 3", "Nacional Nivel 1"
  disciplines public.gymnastics_discipline_code[] NOT NULL DEFAULT ARRAY['GAF'::public.gymnastics_discipline_code],
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create Judge Assignments Table (Binds judge to championship, category, apparatus, and panel role)
CREATE TABLE IF NOT EXISTS public.judge_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  apparatus_id UUID NOT NULL REFERENCES public.apparatuses(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL REFERENCES public.judges(id) ON DELETE CASCADE,
  panel_role public.judge_panel_role NOT NULL,
  rotation_group TEXT,                   -- Optional: restrict to a specific rotation/subdivision
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_judge_apparatus_assignment UNIQUE (championship_id, apparatus_id, panel_role, rotation_group)
);

-- 4. Create Scores Table
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  apparatus_id UUID NOT NULL REFERENCES public.apparatuses(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL DEFAULT 1, -- Usually 1; Salto (VT) can have 2 attempts for event finals
  -- Score Components
  d_score NUMERIC(5, 3) NOT NULL DEFAULT 0.000,
  e_scores JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of individual E-judges scores, e.g. [8.5, 8.6, 8.4, 8.5]
  e_score_avg NUMERIC(5, 3) NOT NULL DEFAULT 0.000,
  neutral_deductions NUMERIC(5, 3) NOT NULL DEFAULT 0.000,
  final_score NUMERIC(5, 3) NOT NULL DEFAULT 0.000,
  -- Status and publication lifecycle
  status public.score_status NOT NULL DEFAULT 'draft',
  submitted_by_judge_id UUID REFERENCES public.judges(id),
  approved_by_user_id UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_score_registration_apparatus_attempt UNIQUE (registration_id, apparatus_id, attempt_number)
);

-- 5. Score Audits Table (Refined from earlier stub, fully immutable)
CREATE TABLE IF NOT EXISTS public.score_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id UUID NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  modified_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  reason TEXT NOT NULL,
  previous_value JSONB NOT NULL,
  new_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for high-speed live scoring queries
CREATE INDEX IF NOT EXISTS idx_judges_org ON public.judges(organization_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_champ ON public.judge_assignments(championship_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge ON public.judge_assignments(judge_id);
CREATE INDEX IF NOT EXISTS idx_scores_champ_apparatus ON public.scores(championship_id, apparatus_id);
CREATE INDEX IF NOT EXISTS idx_scores_registration ON public.scores(registration_id);
CREATE INDEX IF NOT EXISTS idx_scores_status ON public.scores(status);
CREATE INDEX IF NOT EXISTS idx_score_audits_score ON public.score_audits(score_id);

-- ==============================================================================
-- 6. Helper Security Definer Functions for Judge Authorization
-- ==============================================================================

-- Check if current authenticated user is assigned to score this specific apparatus in this championship
CREATE OR REPLACE FUNCTION public.current_user_can_score_apparatus(target_championship_id UUID, target_apparatus_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.judge_assignments ja
    JOIN public.judges j ON ja.judge_id = j.id
    WHERE ja.championship_id = target_championship_id
      AND ja.apparatus_id = target_apparatus_id
      AND j.user_id = auth.uid()
  );
$$;

-- Trigger to record audit trail on score modification
CREATE OR REPLACE FUNCTION public.audit_score_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  -- Only audit if scores or status actually changed and previous status was not draft
  IF (OLD.final_score IS DISTINCT FROM NEW.final_score OR OLD.d_score IS DISTINCT FROM NEW.d_score) 
     AND OLD.status IN ('submitted', 'provisional', 'official_approved') THEN
    
    SELECT organization_id INTO org_id 
    FROM public.championships 
    WHERE id = NEW.championship_id;

    INSERT INTO public.score_audits (
      score_id,
      organization_id,
      modified_by_user_id,
      reason,
      previous_value,
      new_value
    ) VALUES (
      NEW.id,
      org_id,
      auth.uid(),
      COALESCE(NEW.notes, 'Corrección de nota autorizada por Jurado Superior'),
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_score_changes ON public.scores;
CREATE TRIGGER trg_audit_score_changes
  AFTER UPDATE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION public.audit_score_changes();

-- ==============================================================================
-- 7. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.judges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_audits ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS: public.judges & judge_assignments
-- ------------------------------------------------------------------------------
CREATE POLICY "Judges are viewable by organization members"
  ON public.judges FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
  );

CREATE POLICY "Org managers can manage judges"
  ON public.judges FOR ALL TO authenticated
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

CREATE POLICY "Judge assignments are viewable by org members and judges"
  ON public.judge_assignments FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = judge_assignments.championship_id
        AND c.organization_id IN (SELECT public.get_user_organization_ids(auth.uid()))
    )
  );

CREATE POLICY "Org managers can manage judge assignments"
  ON public.judge_assignments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = judge_assignments.championship_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.current_user_has_org_role(
            c.organization_id,
            ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role, 'head_judge'::public.organization_role]
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = judge_assignments.championship_id
        AND (
          public.is_platform_admin(auth.uid())
          OR public.current_user_has_org_role(
            c.organization_id,
            ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role, 'head_judge'::public.organization_role]
          )
        )
    )
  );

-- ------------------------------------------------------------------------------
-- RLS: public.scores (Strict publication and judge insertion policy)
-- ------------------------------------------------------------------------------
CREATE POLICY "Official approved or provisional scores are publicly viewable"
  ON public.scores FOR SELECT TO public
  USING (
    status IN ('provisional', 'official_approved')
    OR (
      auth.uid() IS NOT NULL AND (
        public.is_platform_admin(auth.uid())
        OR public.current_user_can_score_apparatus(championship_id, apparatus_id)
        OR EXISTS (
          SELECT 1 FROM public.championships c
          WHERE c.id = scores.championship_id
            AND public.current_user_has_org_role(
              c.organization_id,
              ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role, 'head_judge'::public.organization_role]
            )
        )
      )
    )
  );

CREATE POLICY "Assigned judges and org managers can insert scores"
  ON public.scores FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_can_score_apparatus(championship_id, apparatus_id)
    OR EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = championship_id
        AND public.current_user_has_org_role(
          c.organization_id,
          ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role, 'head_judge'::public.organization_role]
        )
    )
  );

CREATE POLICY "Assigned judges and org managers can update scores"
  ON public.scores FOR UPDATE TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_can_score_apparatus(championship_id, apparatus_id)
    OR EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = scores.championship_id
        AND public.current_user_has_org_role(
          c.organization_id,
          ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role, 'head_judge'::public.organization_role]
        )
    )
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR public.current_user_can_score_apparatus(championship_id, apparatus_id)
    OR EXISTS (
      SELECT 1 FROM public.championships c
      WHERE c.id = scores.championship_id
        AND public.current_user_has_org_role(
          c.organization_id,
          ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role, 'head_judge'::public.organization_role]
        )
    )
  );

-- ------------------------------------------------------------------------------
-- RLS: public.score_audits (Strict read-only for auditors, written only by trigger)
-- ------------------------------------------------------------------------------
CREATE POLICY "Audits are readable by org admins and head judges"
  ON public.score_audits FOR SELECT TO authenticated
  USING (
    public.is_platform_admin(auth.uid())
    OR public.current_user_has_org_role(
      organization_id,
      ARRAY['org_admin'::public.organization_role, 'competition_manager'::public.organization_role, 'head_judge'::public.organization_role]
    )
  );
