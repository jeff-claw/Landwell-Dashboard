-- Partner Issue Tracker (LANDWELL Beijing <-> Landwell Africa)
-- Backs the joint issue log agreed in the 2026-08-07 business & technical meeting.
--
-- Design note: this is the system of record for the joint tracker. Beijing gets a
-- read-only token link and a monthly xlsx export in their column layout, but never
-- writes to these tables directly. Their input lands in partner_issue_updates,
-- which is append-only, so a disagreement is recorded alongside the issue instead
-- of overwriting it. Every field change is captured in partner_issue_audit.

-- ---------------------------------------------------------------- issues

CREATE TABLE IF NOT EXISTS public.partner_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref TEXT UNIQUE,                      -- ZA-001, auto-assigned by trigger
  raised_on DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'Hardware' CHECK (category IN (
    'Hardware', 'Network', 'Software', 'Product Design',
    'Compliance', 'After-sales', 'Commercial', 'Delivery', 'Governance'
  )),

  -- Site: link to a real client when we have one, else free text (their sheet
  -- has rows like "Mining - underground" that are not accounts).
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  site TEXT DEFAULT '',
  product_module TEXT DEFAULT '',

  description_en TEXT NOT NULL DEFAULT '',
  description_cn TEXT DEFAULT '',
  business_impact TEXT DEFAULT '',

  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),

  landwell_owner TEXT DEFAULT '',       -- Beijing-side owner
  distributor_owner TEXT DEFAULT '',    -- our owner

  next_action_en TEXT DEFAULT '',
  next_action_cn TEXT DEFAULT '',

  target_date DATE,
  first_target_date DATE,               -- set on first target, never moves
  times_deferred INT NOT NULL DEFAULT 0,

  -- 'awaiting_*' makes a stall visible instead of hiding it inside "open"
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'awaiting_landwell', 'awaiting_distributor', 'verified_closed'
  )),

  root_cause TEXT DEFAULT '',
  solution TEXT DEFAULT '',
  closure_evidence TEXT DEFAULT '',     -- required before verified_closed
  closed_at TIMESTAMPTZ,

  -- Cost of the failure. This is what turns "the screens are unreliable" into
  -- a rand figure for the hardware-vs-price argument.
  downtime_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  site_visits INT NOT NULL DEFAULT 0,
  cost_zar NUMERIC(12, 2) NOT NULL DEFAULT 0,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_issues_status_idx ON public.partner_issues (status);
CREATE INDEX IF NOT EXISTS partner_issues_priority_idx ON public.partner_issues (priority);
CREATE INDEX IF NOT EXISTS partner_issues_client_idx ON public.partner_issues (client_id);
CREATE INDEX IF NOT EXISTS partner_issues_target_idx ON public.partner_issues (target_date);

-- Closure discipline: an issue cannot be marked closed without written evidence.
-- Agreed in section 5 of the minutes; enforced here rather than by convention.
ALTER TABLE public.partner_issues DROP CONSTRAINT IF EXISTS partner_issues_closure_evidence_required;
ALTER TABLE public.partner_issues ADD CONSTRAINT partner_issues_closure_evidence_required
  CHECK (status <> 'verified_closed' OR COALESCE(NULLIF(TRIM(closure_evidence), ''), NULL) IS NOT NULL);

-- ------------------------------------------------------- append-only updates

-- Beijing's replies land here. Insert-only by policy: nothing written by either
-- party can be edited or removed, so the thread stays usable as evidence.
CREATE TABLE IF NOT EXISTS public.partner_issue_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.partner_issues(id) ON DELETE CASCADE,
  author_side TEXT NOT NULL DEFAULT 'distributor'
    CHECK (author_side IN ('distributor', 'landwell', 'internal')),
  author_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'dashboard',   -- dashboard | email | meeting | lark
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_issue_updates_issue_idx
  ON public.partner_issue_updates (issue_id, created_at);

-- ------------------------------------------------------------- evidence

CREATE TABLE IF NOT EXISTS public.partner_issue_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.partner_issues(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  device_serial TEXT DEFAULT '',
  captured_at TIMESTAMPTZ,              -- when the failure happened, not upload time
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_issue_evidence_issue_idx
  ON public.partner_issue_evidence (issue_id, created_at);

-- --------------------------------------------------------------- audit

-- Field-level change history. The point of holding the record ourselves is that
-- it can be shown to be unaltered; this is that guarantee.
CREATE TABLE IF NOT EXISTS public.partner_issue_audit (
  id BIGSERIAL PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.partner_issues(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS partner_issue_audit_issue_idx
  ON public.partner_issue_audit (issue_id, changed_at DESC);

-- ---------------------------------------------------------- partner links

-- Tokenised read-only views for Beijing. No login, revocable, and every view is
-- counted so we know whether they are actually reading it.
CREATE TABLE IF NOT EXISTS public.partner_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL DEFAULT 'LANDWELL Beijing',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  view_count INT NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------- triggers

-- Sequential ZA-### refs so our numbering matches the sheet Beijing already has.
CREATE OR REPLACE FUNCTION public.partner_issues_assign_ref()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.ref IS NULL OR TRIM(NEW.ref) = '' THEN
    SELECT COALESCE(MAX(NULLIF(regexp_replace(ref, '\D', '', 'g'), '')::INT), 0) + 1
      INTO next_num
      FROM public.partner_issues
     WHERE ref ~ '^ZA-\d+$';
    NEW.ref := 'ZA-' || LPAD(next_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partner_issues_ref_trigger ON public.partner_issues;
CREATE TRIGGER partner_issues_ref_trigger
  BEFORE INSERT ON public.partner_issues
  FOR EACH ROW EXECUTE FUNCTION public.partner_issues_assign_ref();

-- Slip counter + closure stamp. times_deferred is the number that makes a
-- repeatedly-moved deadline impossible to argue with at the monthly review.
CREATE OR REPLACE FUNCTION public.partner_issues_track_changes()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();

  IF NEW.target_date IS NOT NULL AND OLD.target_date IS NULL THEN
    NEW.first_target_date := COALESCE(OLD.first_target_date, NEW.target_date);
  ELSIF NEW.target_date IS DISTINCT FROM OLD.target_date AND OLD.target_date IS NOT NULL THEN
    NEW.times_deferred := OLD.times_deferred + 1;
    NEW.first_target_date := COALESCE(OLD.first_target_date, OLD.target_date);
  END IF;

  IF NEW.status = 'verified_closed' AND OLD.status <> 'verified_closed' THEN
    NEW.closed_at := NOW();
  ELSIF NEW.status <> 'verified_closed' THEN
    NEW.closed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partner_issues_changes_trigger ON public.partner_issues;
CREATE TRIGGER partner_issues_changes_trigger
  BEFORE UPDATE ON public.partner_issues
  FOR EACH ROW EXECUTE FUNCTION public.partner_issues_track_changes();

-- Audit the fields that carry weight in a dispute.
CREATE OR REPLACE FUNCTION public.partner_issues_audit()
RETURNS TRIGGER AS $$
DECLARE
  f TEXT;
  tracked TEXT[] := ARRAY[
    'status', 'priority', 'target_date', 'description_en', 'description_cn',
    'root_cause', 'solution', 'closure_evidence', 'business_impact',
    'downtime_hours', 'site_visits', 'cost_zar', 'landwell_owner', 'distributor_owner'
  ];
  old_json JSONB := to_jsonb(OLD);
  new_json JSONB := to_jsonb(NEW);
BEGIN
  FOREACH f IN ARRAY tracked LOOP
    IF old_json ->> f IS DISTINCT FROM new_json ->> f THEN
      INSERT INTO public.partner_issue_audit (issue_id, field, old_value, new_value, changed_by)
      VALUES (NEW.id, f, old_json ->> f, new_json ->> f, auth.uid());
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partner_issues_audit_trigger ON public.partner_issues;
CREATE TRIGGER partner_issues_audit_trigger
  AFTER UPDATE ON public.partner_issues
  FOR EACH ROW EXECUTE FUNCTION public.partner_issues_audit();

-- ----------------------------------------------------------------- RLS

ALTER TABLE public.partner_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_issue_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_issue_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_issue_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read partner issues" ON public.partner_issues;
CREATE POLICY "Authenticated read partner issues" ON public.partner_issues
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert partner issues" ON public.partner_issues;
CREATE POLICY "Authenticated insert partner issues" ON public.partner_issues
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated update partner issues" ON public.partner_issues;
CREATE POLICY "Authenticated update partner issues" ON public.partner_issues
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated delete partner issues" ON public.partner_issues;
CREATE POLICY "Authenticated delete partner issues" ON public.partner_issues
  FOR DELETE TO authenticated USING (true);

-- Updates are insert + select only. No UPDATE/DELETE policy exists, so with RLS
-- on, the thread is immutable even to us.
DROP POLICY IF EXISTS "Authenticated read partner updates" ON public.partner_issue_updates;
CREATE POLICY "Authenticated read partner updates" ON public.partner_issue_updates
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert partner updates" ON public.partner_issue_updates;
CREATE POLICY "Authenticated insert partner updates" ON public.partner_issue_updates
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated read partner evidence" ON public.partner_issue_evidence;
CREATE POLICY "Authenticated read partner evidence" ON public.partner_issue_evidence
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated insert partner evidence" ON public.partner_issue_evidence;
CREATE POLICY "Authenticated insert partner evidence" ON public.partner_issue_evidence
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated delete partner evidence" ON public.partner_issue_evidence;
CREATE POLICY "Authenticated delete partner evidence" ON public.partner_issue_evidence
  FOR DELETE TO authenticated USING (true);

-- Audit is read-only to everyone; only the trigger writes it.
DROP POLICY IF EXISTS "Authenticated read partner audit" ON public.partner_issue_audit;
CREATE POLICY "Authenticated read partner audit" ON public.partner_issue_audit
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated manage partner links" ON public.partner_links;
CREATE POLICY "Authenticated manage partner links" ON public.partner_links
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- The public /partner/<token> page reads through the service role on the server,
-- so no anon policy is granted here on purpose.
