-- ==============================================================================
-- Migration: 20261103000008_fix_fast_judge_rpc_and_vault_two_attempts.sql
-- Description: 
--   1. Adds B-Tree indexes on invite_code and judge_code for high-speed lookup.
--   2. Updates submit_fast_judge_score to support p_attempt_number (1 or 2)
--      for Vault (VT) event finals without overwriting attempt 1.
--   3. Replaces get_championship_by_code with subquery aggregation to prevent
--      PostgreSQL GROUP BY syntax errors and protect athlete PII.
-- ==============================================================================

-- 1. Create lookup indexes on championship codes
CREATE INDEX IF NOT EXISTS idx_championships_invite_code 
  ON public.championships (UPPER(TRIM(invite_code)));

CREATE INDEX IF NOT EXISTS idx_championships_judge_code 
  ON public.championships (UPPER(TRIM(judge_code)));

-- 2. Enhanced submit_fast_judge_score with 2-attempt Vault support
-- Drop previous 10-argument overload if it exists to avoid ambiguity error 42725
DROP FUNCTION IF EXISTS public.submit_fast_judge_score(UUID, TEXT, UUID, UUID, TEXT, NUMERIC, JSONB, NUMERIC, NUMERIC, NUMERIC);

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
  v_attempt INT;
BEGIN
  v_attempt := COALESCE(p_attempt_number, 1);
  IF v_attempt NOT IN (1, 2) THEN
    RAISE EXCEPTION 'El número de intento debe ser 1 o 2.';
  END IF;

  -- Verify judge code matches championship
  SELECT judge_code INTO v_expected_code
  FROM public.championships
  WHERE id = p_championship_id;

  IF v_expected_code IS NULL OR TRIM(UPPER(v_expected_code)) <> TRIM(UPPER(p_judge_code)) THEN
    RAISE EXCEPTION 'Código de juez inválido para este campeonato.';
  END IF;

  -- Upsert score with attempt_number (attempt 1 and 2 are stored independently)
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

GRANT EXECUTE ON FUNCTION public.submit_fast_judge_score TO anon, authenticated;

-- 3. Robust get_championship_by_code with subquery aggregation & privacy
CREATE OR REPLACE FUNCTION public.get_championship_by_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_champ RECORD;
  v_categories JSONB;
  v_apparatuses JSONB;
  v_registrations JSONB;
BEGIN
  -- Lookup championship by invite_code or judge_code
  SELECT id, organization_id, name, slug, description, start_date, end_date, location, venue_name,
         visibility, status, ruleset_version, invite_code, judge_code, bases_url, entry_fee_info
  INTO v_champ
  FROM public.championships
  WHERE TRIM(UPPER(invite_code)) = TRIM(UPPER(p_code))
     OR TRIM(UPPER(judge_code)) = TRIM(UPPER(p_code))
  LIMIT 1;

  IF v_champ IS NULL THEN
    RETURN NULL;
  END IF;

  -- Categories ordered via subquery (avoids GROUP BY conflict)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'code', code,
    'discipline', discipline,
    'gender', gender,
    'scoring_regime', scoring_regime,
    'default_fixed_d_score', default_fixed_d_score
  )), '[]'::jsonb)
  INTO v_categories
  FROM (
    SELECT id, name, code, discipline, gender, scoring_regime, default_fixed_d_score
    FROM public.categories
    WHERE championship_id = v_champ.id
    ORDER BY sort_order ASC
  ) c;

  -- Apparatuses for GAF ordered via subquery
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'code', code,
    'name', name,
    'discipline', discipline
  )), '[]'::jsonb)
  INTO v_apparatuses
  FROM (
    SELECT id, code, name, discipline
    FROM public.apparatuses
    WHERE discipline = 'GAF'
    ORDER BY sort_order ASC
  ) a;

  -- Approved Registrations (PII protected: no RUT, no birthdate, no contact phone)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', sub.id,
    'bib_number', sub.bib_number,
    'rotation_group', sub.rotation_group,
    'gymnast_name', sub.first_name || ' ' || sub.last_name,
    'club_name', sub.club_name,
    'category_name', sub.category_name,
    'scoring_regime', sub.scoring_regime,
    'default_fixed_d_score', sub.default_fixed_d_score
  )), '[]'::jsonb)
  INTO v_registrations
  FROM (
    SELECT 
      r.id,
      r.bib_number,
      r.rotation_group,
      g.first_name,
      g.last_name,
      c.name AS club_name,
      cat.name AS category_name,
      cat.scoring_regime,
      cat.default_fixed_d_score
    FROM public.registrations r
    JOIN public.gymnasts g ON g.id = r.gymnast_id
    JOIN public.clubs c ON c.id = r.club_id
    LEFT JOIN public.categories cat ON cat.id = r.category_id
    WHERE r.championship_id = v_champ.id
      AND r.status = 'approved'
    ORDER BY g.last_name ASC, g.first_name ASC
  ) sub;

  RETURN jsonb_build_object(
    'championship', row_to_json(v_champ),
    'categories', v_categories,
    'apparatuses', v_apparatuses,
    'registrations', v_registrations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_championship_by_code TO anon, authenticated;
