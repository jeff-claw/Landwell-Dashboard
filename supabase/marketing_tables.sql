-- Landwell Marketing cockpit tables
-- Run once in Supabase → SQL Editor. Safe to re-run (IF NOT EXISTS + idempotent seed).

-- 1. Marketing tasks (the weekly brief / Verushka's work items) -----------------
CREATE TABLE IF NOT EXISTS public.marketing_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  detail TEXT,
  channel TEXT,                                  -- expo | warm_quotes | linkedin | google_business | youtube | other
  status TEXT NOT NULL DEFAULT 'todo',           -- todo | in_progress | blocked | done
  assignee TEXT DEFAULT 'Verushka',
  due_date DATE,
  week_of DATE,                                  -- Monday of the brief week
  time_estimate_hrs NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.marketing_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read marketing_tasks"   ON public.marketing_tasks;
DROP POLICY IF EXISTS "auth write marketing_tasks"  ON public.marketing_tasks;
CREATE POLICY "auth read marketing_tasks"  ON public.marketing_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write marketing_tasks" ON public.marketing_tasks FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- 2. Marketing channels (the 5 fixed priorities + editable status) --------------
CREATE TABLE IF NOT EXISTS public.marketing_channels (
  key TEXT PRIMARY KEY,                          -- expo | warm_quotes | linkedin | google_business | youtube
  label TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_started',    -- not_started | active | done | blocked
  note TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.marketing_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth read marketing_channels"  ON public.marketing_channels;
DROP POLICY IF EXISTS "auth write marketing_channels" ON public.marketing_channels;
CREATE POLICY "auth read marketing_channels"  ON public.marketing_channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write marketing_channels" ON public.marketing_channels FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- Seed the 5 channel priorities (from marketing-plan-2026-v2). Idempotent.
INSERT INTO public.marketing_channels (key, label, priority, status, note) VALUES
  ('expo',            'Expo / booth follow-up (Stand C25 + Securex)', 0, 'not_started', 'Freshest leads — send within 48h'),
  ('warm_quotes',     '94 warm quotes — reactivation',                1, 'not_started', 'Cheapest revenue. Diagnose cold-reason first'),
  ('linkedin',        'LinkedIn outreach + Tiaan activation',         2, 'not_started', '~15 personalised msgs/week'),
  ('google_business', 'Google Business Profile + compliance pages',   3, 'not_started', 'Currently MISSING — create/verify'),
  ('youtube',         'YouTube product demos',                        4, 'not_started', 'Later — one walkthrough/month')
ON CONFLICT (key) DO NOTHING;
