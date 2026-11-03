-- ==============================================================================
-- Migration: 20261103000005_category_level_regimes_and_fixed_d_scores.sql
-- Description: Adds technical regime (libres vs obligatorios/rutinas establecidas),
--              fixed D-score for obligatory routines, and apparatus overrides.
-- ==============================================================================

-- 1. Create Technical Level Regime Enum
CREATE TYPE public.category_scoring_regime AS ENUM (
  'free',        -- Nivel Libre / Fig / Opcional: Jurado D (Dificultad evaluada en vivo) + Jurado E
  'obligatory'   -- Nivel No Libre / Rutina Establecida / Obligatoria: Nota D predeterminada, jurado solo evalúa E
);

-- 2. Add scoring_regime and default_fixed_d_score to public.categories
ALTER TABLE public.categories 
  ADD COLUMN IF NOT EXISTS scoring_regime public.category_scoring_regime NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS default_fixed_d_score NUMERIC(5, 3) DEFAULT 10.000;

-- 3. Add apparatus-specific fixed D-score to public.category_apparatuses
-- Allows setting e.g. Salto D=10.0, Suelo D=10.0, Viga D=9.500 when obligatory
ALTER TABLE public.category_apparatuses 
  ADD COLUMN IF NOT EXISTS fixed_d_score NUMERIC(5, 3) DEFAULT NULL;
