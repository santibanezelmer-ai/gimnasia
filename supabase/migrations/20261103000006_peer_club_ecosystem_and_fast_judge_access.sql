-- ==============================================================================
-- Migration: 20261103000006_peer_club_ecosystem_and_fast_judge_access.sql
-- Description: Supports peer-to-peer club championships, open invitations with bases,
--              and fast judge scoring access via championship code / PIN.
-- ==============================================================================

-- 1. Add invitation and judge codes + bases documentation to public.championships
ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS invite_code TEXT,
  ADD COLUMN IF NOT EXISTS judge_code TEXT,
  ADD COLUMN IF NOT EXISTS bases_url TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS entry_fee_info TEXT;

-- Generate default codes for any existing championships that lack them
UPDATE public.championships
SET 
  invite_code = COALESCE(invite_code, UPPER(SUBSTRING(slug, 1, 6)) || '-' || LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0')),
  judge_code  = COALESCE(judge_code, 'JUEZ-' || LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0'))
WHERE invite_code IS NULL OR judge_code IS NULL;

-- Demo Championship specific codes
UPDATE public.championships
SET 
  invite_code = 'COPA-GAF-2026',
  judge_code = 'JUEZ-2026',
  entry_fee_info = '$25.000 CLP por gimnasta (Incluye diploma y medalla de participación)',
  bases_url = 'https://operix.app/docs/bases-nacional-gaf-2026.pdf'
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- 2. Add judge_name to public.scores for fast-access judge tracking
ALTER TABLE public.scores
  ADD COLUMN IF NOT EXISTS judge_name TEXT;

-- 3. Secure Function: submit_fast_judge_score
-- Allows judges entering via Championship Code + Name to submit scores directly
-- without requiring a complex Supabase auth email/password account.
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
SET search_path = public
AS $$
DECLARE
  v_score_id UUID;
  v_expected_code TEXT;
BEGIN
  -- Verify judge code matches championship
  SELECT judge_code INTO v_expected_code
  FROM public.championships
  WHERE id = p_championship_id;

  IF v_expected_code IS NULL OR TRIM(UPPER(v_expected_code)) <> TRIM(UPPER(p_judge_code)) THEN
    RAISE EXCEPTION 'Código de juez inválido para este campeonato.';
  END IF;

  -- Upsert score with status = 'provisional'
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
    1,
    p_d_score,
    p_e_scores,
    p_e_score_avg,
    p_neutral_deductions,
    p_final_score,
    'provisional',
    p_judge_name,
    'Enviado en vivo desde terminal por juez: ' || p_judge_name
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

-- Grant execution to all users (both anon and authenticated)
GRANT EXECUTE ON FUNCTION public.submit_fast_judge_score TO anon, authenticated;

-- 4. Function: get_championship_by_code
-- Resolves championship info, categories and apparatuses from invite_code or judge_code
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

  -- Categories
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
  FROM public.categories
  WHERE championship_id = v_champ.id;

  -- Apparatuses for GAF
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'code', code,
    'name', name,
    'discipline', discipline
  )), '[]'::jsonb)
  INTO v_apparatuses
  FROM public.apparatuses
  WHERE discipline = 'GAF'
  ORDER BY sort_order;

  -- Approved Registrations with Gymnast & Club
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'bib_number', r.bib_number,
    'rotation_group', r.rotation_group,
    'gymnast_name', g.first_name || ' ' || g.last_name,
    'club_name', c.name,
    'category_name', cat.name,
    'scoring_regime', cat.scoring_regime,
    'default_fixed_d_score', cat.default_fixed_d_score
  )), '[]'::jsonb)
  INTO v_registrations
  FROM public.registrations r
  JOIN public.gymnasts g ON g.id = r.gymnast_id
  JOIN public.clubs c ON c.id = r.club_id
  LEFT JOIN public.categories cat ON cat.id = r.category_id
  WHERE r.championship_id = v_champ.id
    AND r.status = 'approved';

  RETURN jsonb_build_object(
    'championship', row_to_json(v_champ),
    'categories', v_categories,
    'apparatuses', v_apparatuses,
    'registrations', v_registrations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_championship_by_code TO anon, authenticated;
