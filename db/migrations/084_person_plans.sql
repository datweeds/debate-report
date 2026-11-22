-- Plans belong to a person: a Society uses its owner's plan, and storage and
-- AI are shared across all the Societies that person owns.

-- The Society's owner: whose plan it uses (starts as its creator; can be handed to another Society Admin)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
UPDATE customers c SET owner_id = u.id
  FROM users u WHERE c.owner_id IS NULL AND c.created_by IS NOT NULL AND u.id::text = c.created_by;
CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers (owner_id) WHERE owner_id IS NOT NULL;

-- Grants go to a person now
ALTER TABLE plan_grants ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE plan_grants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_plan_grants_user ON plan_grants (user_id) WHERE revoked_at IS NULL;

-- Warnings and storage grace are per pool: a person ('u:<id>') or an ownerless Society ('s:<id>')
CREATE TABLE IF NOT EXISTS plan_limit_alerts (
    pool    TEXT        NOT NULL,
    measure TEXT        NOT NULL CHECK (measure IN ('storage', 'ai')),
    level   INTEGER     NOT NULL CHECK (level IN (80, 100)),
    period  TEXT        NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (pool, measure, level, period)
);
CREATE TABLE IF NOT EXISTS plan_storage_over (
    pool  TEXT        PRIMARY KEY,
    since TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TABLE IF EXISTS society_limit_alerts;
DROP TABLE IF EXISTS society_storage_over;

-- The read-only message, for plans that belong to people
CREATE OR REPLACE FUNCTION trg_society_writable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid INTEGER;
BEGIN
  IF TG_ARGV[0] = 'customer_id' THEN cid := NEW.customer_id;
  ELSIF TG_ARGV[0] = 'thread' THEN SELECT customer_id INTO cid FROM discussion_threads WHERE id = NEW.thread_id;
  ELSIF TG_ARGV[0] = 'project' THEN SELECT customer_id INTO cid FROM projects WHERE id = NEW.project_id;
  ELSIF TG_ARGV[0] = 'statement' THEN SELECT customer_id INTO cid FROM statements WHERE id = NEW.statement_id;
  END IF;
  IF cid IS NOT NULL AND EXISTS (SELECT 1 FROM customers WHERE id = cid AND held_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This Society is read-only for now: it’s over the number of Societies its owner’s plan covers. Its owner can move to a bigger plan, or make it one of their active Societies.'
      USING HINT = 'society_held';
  END IF;
  RETURN NEW;
END $$;
