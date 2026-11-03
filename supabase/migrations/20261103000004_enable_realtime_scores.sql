-- ==============================================================================
-- Migration: 20261103000004_enable_realtime_scores.sql
-- Description: Enable Supabase Realtime publication on public.scores table
--              so live boards receive instant websocket broadcasts.
-- ==============================================================================

-- 1. Enable Full Replica Identity so UPDATE/DELETE events carry complete old/new payloads
ALTER TABLE public.scores REPLICA IDENTITY FULL;

-- 2. Add public.scores to supabase_realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
  END IF;
END $$;
