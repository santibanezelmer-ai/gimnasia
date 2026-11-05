-- Operix Gymnastics — Phase 9: Operix Awards & Ceremonies
-- Ciclo Olímpico FIG 2025-2028.
-- Desarrollado por Comercial Hels SpA.

-- 1. Configuration for championship awards and ceremonies
CREATE TABLE IF NOT EXISTS public.championship_awards_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    places_awarded_count INTEGER NOT NULL DEFAULT 3,
    few_participants_rule TEXT NOT NULL DEFAULT 'standard_all', -- 'standard_all' | 'strict_n_minus_one'
    include_trophies_for_teams BOOLEAN NOT NULL DEFAULT TRUE,
    include_club_medals BOOLEAN NOT NULL DEFAULT TRUE,
    special_awards JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_champ_awards_config UNIQUE (championship_id)
);

-- 2. State tracking of award ceremonies to avoid duplicates and audit execution
CREATE TABLE IF NOT EXISTS public.championship_awards_ceremonies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    ceremony_key TEXT NOT NULL,
    ceremony_type TEXT NOT NULL, -- 'all_around' | 'apparatus' | 'team' | 'club_tally' | 'special'
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    apparatus_code TEXT,
    title TEXT NOT NULL,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'completed'
    podium_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    awarded_at TIMESTAMPTZ,
    awarded_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_champ_ceremony_key UNIQUE (championship_id, ceremony_key)
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_awards_config_champ ON public.championship_awards_config(championship_id);
CREATE INDEX IF NOT EXISTS idx_awards_ceremonies_champ_status ON public.championship_awards_ceremonies(championship_id, status);

-- Row Level Security
ALTER TABLE public.championship_awards_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.championship_awards_ceremonies ENABLE ROW LEVEL SECURITY;

-- Policies for championship_awards_config
DROP POLICY IF EXISTS "Public and members can read awards config" ON public.championship_awards_config;
CREATE POLICY "Public and members can read awards config"
    ON public.championship_awards_config
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Org admins can manage awards config" ON public.championship_awards_config;
CREATE POLICY "Org admins can manage awards config"
    ON public.championship_awards_config
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.championships c
            JOIN public.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = championship_awards_config.championship_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'director')
        )
    );

-- Policies for championship_awards_ceremonies
DROP POLICY IF EXISTS "Public and members can read ceremonies" ON public.championship_awards_ceremonies;
CREATE POLICY "Public and members can read ceremonies"
    ON public.championship_awards_ceremonies
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Org admins and judges can manage ceremonies" ON public.championship_awards_ceremonies;
CREATE POLICY "Org admins and judges can manage ceremonies"
    ON public.championship_awards_ceremonies
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.championships c
            JOIN public.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = championship_awards_ceremonies.championship_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'director', 'judge')
        )
    );
