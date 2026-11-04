-- ==============================================================================
-- Migration: 20261104000009_multi_discipline_apparatuses_and_parkour.sql
-- Description: Official FIG Multi-Discipline Expansion (Ciclo Olímpico 2025-2028).
--              Adds Parkour (PK) to discipline enum, columns for Artistic, Trampoline
--              and Parkour Speed timing, and seeds official FIG apparatuses across all 7 disciplines.
-- Author: Desarrollado por Comercial Hels SpA
-- ==============================================================================

-- 1. Safely add 'PK' (Parkour) to gymnastics_discipline_code enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.gymnastics_discipline_code'::regtype
      AND enumlabel = 'PK'
  ) THEN
    ALTER TYPE public.gymnastics_discipline_code ADD VALUE 'PK';
  END IF;
END $$;

-- 2. Add multi-discipline metrics columns to public.scores
ALTER TABLE public.scores
  ADD COLUMN IF NOT EXISTS a_score NUMERIC(6, 3),
  ADD COLUMN IF NOT EXISTS tof_score NUMERIC(6, 3),
  ADD COLUMN IF NOT EXISTS hd_score NUMERIC(6, 3),
  ADD COLUMN IF NOT EXISTS time_seconds NUMERIC(8, 3),
  ADD COLUMN IF NOT EXISTS penalty_seconds NUMERIC(8, 3);

COMMENT ON COLUMN public.scores.a_score IS 'Artistic Score for Rhythmic (GR), Aerobic (AER), and Acrobatic (ACRO) routines';
COMMENT ON COLUMN public.scores.tof_score IS 'Time of Flight (ToF) in seconds for Trampoline (TRA)';
COMMENT ON COLUMN public.scores.hd_score IS 'Horizontal Displacement (HD) for Trampoline (TRA)';
COMMENT ON COLUMN public.scores.time_seconds IS 'Raw electronic/manual track time for Parkour Speed (PK-SPD)';
COMMENT ON COLUMN public.scores.penalty_seconds IS 'Penalty seconds for missed obstacles or course boundaries in Parkour Speed (PK-SPD)';

-- 3. Seed / Upsert Official FIG Apparatuses for all 7 disciplines
INSERT INTO public.apparatuses (discipline, code, name, sort_order) VALUES
  -- GAF (Women's Artistic Gymnastics)
  ('GAF', 'VT', 'Salto de Caballo / Salto', 1),
  ('GAF', 'UB', 'Barras Asimétricas', 2),
  ('GAF', 'BB', 'Viga de Equilibrio', 3),
  ('GAF', 'FX', 'Suelo / Manos Libres', 4),

  -- GAM (Men's Artistic Gymnastics)
  ('GAM', 'FX', 'Suelo', 1),
  ('GAM', 'PH', 'Caballo con Arzones', 2),
  ('GAM', 'SR', 'Anillas', 3),
  ('GAM', 'VT', 'Salto', 4),
  ('GAM', 'PB', 'Barras Paralelas', 5),
  ('GAM', 'HB', 'Barra Fija', 6),

  -- GR (Rhythmic Gymnastics / Gimnasia Rítmica FIG)
  ('GR', 'HOOP', 'Aro', 1),
  ('GR', 'BALL', 'Pelota', 2),
  ('GR', 'CLUBS', 'Mazas', 3),
  ('GR', 'RIBBON', 'Cinta', 4),
  ('GR', 'FREE', 'Manos Libres', 5),
  ('GR', 'GROUP', 'Conjunto / General', 6),

  -- TRA (Trampoline Gymnastics / Trampolín FIG)
  ('TRA', 'TRA', 'Trampolín Individual', 1),
  ('TRA', 'DMT', 'Doble Minitramp (DMT)', 2),
  ('TRA', 'TUM', 'Tumbling', 3),
  ('TRA', 'SYN', 'Trampolín Sincronizado', 4),

  -- AER (Aerobic Gymnastics / Gimnasia Aeróbica FIG)
  ('AER', 'IW', 'Individual Femenino (IW)', 1),
  ('AER', 'IM', 'Individual Masculino (IM)', 2),
  ('AER', 'MP', 'Pareja Mixta (MP)', 3),
  ('AER', 'TR', 'Trío (TR)', 4),
  ('AER', 'GR', 'Grupo (GR)', 5),
  ('AER', 'AD', 'Aerobic Dance (AD)', 6),
  ('AER', 'AS', 'Aerobic Step (AS)', 7),

  -- ACRO (Acrobatic Gymnastics / Gimnasia Acrobática FIG)
  ('ACRO', 'BAL', 'Ejercicio Estático / Balance', 1),
  ('ACRO', 'DYN', 'Ejercicio Dinámico / Tempo', 2),
  ('ACRO', 'COM', 'Ejercicio Combinado', 3),

  -- PK (Parkour FIG - Velocidad y Estilo Libre)
  ('PK', 'SPD', 'Parkour Velocidad (Speed)', 1),
  ('PK', 'FR', 'Parkour Estilo Libre (Freestyle)', 2)

ON CONFLICT (discipline, code) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order;
