-- Operix Gymnastics — Phase 10: Production Stabilization & Supplemental Schemas
-- Ciclo Olímpico FIG 2025-2028.
-- Desarrollado por Comercial Hels SpA.

-- 1. Detailed Score Deductions (Breakdown by Judge and Deductions Type)
CREATE TABLE IF NOT EXISTS public.score_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score_id UUID NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
    judge_id UUID REFERENCES public.judges(id) ON DELETE SET NULL,
    deduction_type TEXT NOT NULL, -- 'execution_fall', 'out_of_bounds', 'time_violation', 'landing_step', 'neutral'
    points NUMERIC(5, 3) NOT NULL, -- e.g. 0.100, 0.300, 0.500, 1.000
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_score_deductions_score ON public.score_deductions(score_id);
CREATE INDEX IF NOT EXISTS idx_score_deductions_type ON public.score_deductions(deduction_type);

ALTER TABLE public.score_deductions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view official score deductions" ON public.score_deductions;
CREATE POLICY "Public can view official score deductions"
    ON public.score_deductions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.scores s
            WHERE s.id = score_deductions.score_id
            AND s.status IN ('provisional', 'official_approved')
        )
    );

DROP POLICY IF EXISTS "Judges and admins can manage score deductions" ON public.score_deductions;
CREATE POLICY "Judges and admins can manage score deductions"
    ON public.score_deductions
    FOR ALL
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);


-- 2. Technical Inquiries (FIG Art. 5.4 Official D-Score Appeals)
CREATE TABLE IF NOT EXISTS public.technical_inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    score_id UUID NOT NULL REFERENCES public.scores(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    gymnast_id UUID NOT NULL REFERENCES public.gymnasts(id) ON DELETE CASCADE,
    submitted_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    inquiry_reason TEXT NOT NULL,
    original_d_score NUMERIC(5, 3) NOT NULL,
    requested_d_score NUMERIC(5, 3),
    resolved_d_score NUMERIC(5, 3),
    fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted' | 'under_review' | 'accepted' | 'rejected'
    resolution_notes TEXT,
    resolved_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inquiries_champ ON public.technical_inquiries(championship_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_score ON public.technical_inquiries(score_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.technical_inquiries(status);

ALTER TABLE public.technical_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members and admins can view inquiries" ON public.technical_inquiries;
CREATE POLICY "Members and admins can view inquiries"
    ON public.technical_inquiries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.championships c
            JOIN public.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = technical_inquiries.championship_id
            AND om.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Delegates can submit inquiries" ON public.technical_inquiries;
CREATE POLICY "Delegates can submit inquiries"
    ON public.technical_inquiries
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Head judges and admins can resolve inquiries" ON public.technical_inquiries;
CREATE POLICY "Head judges and admins can resolve inquiries"
    ON public.technical_inquiries
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.championships c
            JOIN public.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = technical_inquiries.championship_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'competition_manager', 'head_judge')
        )
    );


-- 3. Dedicated Rotation Groups
CREATE TABLE IF NOT EXISTS public.rotation_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. 'Grupo 1', 'Subdivisión A', 'Rotación 1'
    subdivision TEXT,
    starting_apparatus TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_champ_rotation_group UNIQUE (championship_id, name, subdivision)
);

CREATE INDEX IF NOT EXISTS idx_rotation_groups_champ ON public.rotation_groups(championship_id, sort_order);

ALTER TABLE public.rotation_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view rotation groups" ON public.rotation_groups;
CREATE POLICY "Public can view rotation groups"
    ON public.rotation_groups
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage rotation groups" ON public.rotation_groups;
CREATE POLICY "Admins can manage rotation groups"
    ON public.rotation_groups
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.championships c
            JOIN public.organization_members om ON om.organization_id = c.organization_id
            WHERE c.id = rotation_groups.championship_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'competition_manager')
        )
    );
