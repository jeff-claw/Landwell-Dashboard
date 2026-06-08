-- Per-user page access control.
-- Run once in Supabase → SQL Editor. Safe to re-run.

-- 1. Allowed pages per user. NULL = full access (default, backwards-compatible).
--    A JSON array of page keys = restricted to exactly those pages.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS page_access JSONB DEFAULT NULL;

-- 2. Access requests (from the "Request access" button on the denied page).
CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email TEXT,
  page TEXT,
  status TEXT NOT NULL DEFAULT 'open',   -- open | granted | dismissed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read access_requests"  ON public.access_requests;
DROP POLICY IF EXISTS "auth write access_requests" ON public.access_requests;
CREATE POLICY "auth read access_requests"  ON public.access_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write access_requests" ON public.access_requests FOR ALL    TO authenticated USING (true) WITH CHECK (true);
