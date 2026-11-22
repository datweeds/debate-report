-- Plan limits in practice: warnings, a grace period on storage, and "held"
-- Societies. When a paid plan ends (after 30 days' grace) and its owner then
-- runs more than 3 Societies on Huddle, the extra ones are held: still readable
-- and exportable, but nothing new can be added until one is upgraded or
-- another is set aside. Enforced here in the database, so no route can miss it.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION trg_society_writable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid INTEGER;
BEGIN
  IF TG_ARGV[0] = 'customer_id' THEN cid := NEW.customer_id;
  ELSIF TG_ARGV[0] = 'thread' THEN SELECT customer_id INTO cid FROM discussion_threads WHERE id = NEW.thread_id;
  ELSIF TG_ARGV[0] = 'project' THEN SELECT customer_id INTO cid FROM projects WHERE id = NEW.project_id;
  ELSIF TG_ARGV[0] = 'statement' THEN SELECT customer_id INTO cid FROM statements WHERE id = NEW.statement_id;
  END IF;
  IF cid IS NOT NULL AND EXISTS (SELECT 1 FROM customers WHERE id = cid AND held_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This Society is read-only for now: its paid plan has ended, and its owner already runs 3 Societies on Huddle, the free plan. A Society Admin can choose a plan for it, or make it one of the 3 free ones.'
      USING HINT = 'society_held';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['statements', 'discussion_threads', 'documents', 'document_folders', 'projects', 'society_events',
                           'society_event_series', 'society_polls', 'society_principle_versions', 'society_tasks', 'society_rtc_rooms'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS society_writable ON %I', t);
    EXECUTE format('CREATE TRIGGER society_writable BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trg_society_writable(%L)', t, 'customer_id');
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS society_writable ON discussion_posts;
CREATE TRIGGER society_writable BEFORE INSERT ON discussion_posts FOR EACH ROW EXECUTE FUNCTION trg_society_writable('thread');
DROP TRIGGER IF EXISTS society_writable ON project_tasks;
CREATE TRIGGER society_writable BEFORE INSERT ON project_tasks FOR EACH ROW EXECUTE FUNCTION trg_society_writable('project');
DROP TRIGGER IF EXISTS society_writable ON comments;
CREATE TRIGGER society_writable BEFORE INSERT ON comments FOR EACH ROW EXECUTE FUNCTION trg_society_writable('statement');

-- Limit warnings already sent (80% / 100%), so each goes once: per month for
-- AI, and for storage until usage drops back under 80%
CREATE TABLE IF NOT EXISTS society_limit_alerts (
    customer_id INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    measure     TEXT        NOT NULL CHECK (measure IN ('storage', 'ai')),
    level       INTEGER     NOT NULL CHECK (level IN (80, 100)),
    period      TEXT        NOT NULL,
    sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (customer_id, measure, level, period)
);

-- When a Society first went over its storage: 14 days' grace from then
CREATE TABLE IF NOT EXISTS society_storage_over (
    customer_id INTEGER     PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    since       TIMESTAMPTZ NOT NULL DEFAULT now()
);
