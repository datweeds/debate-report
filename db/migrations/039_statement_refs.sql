-- Statement references: a short code unique within its debate (CF1, CA2, RB1, E14…)
-- that debaters can cite in their arguments. Assigned automatically on insert by
-- trigger, so every creation path gets one. Never reused: numbering continues
-- past retracted statements.
--
--   framework FW · claim for CF · claim against CA · claim (no side) C
--   warrant W · evidence E · impact I · rebuttal RB · turn T

ALTER TABLE statements ADD COLUMN IF NOT EXISTS stat_ref TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_statements_resolution_ref
  ON statements (resolution_id, stat_ref) WHERE stat_ref IS NOT NULL;

CREATE OR REPLACE FUNCTION stat_ref_prefix(t stat_type_t, d direction_t)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE t::text
    WHEN 'framework' THEN 'FW'
    WHEN 'claim'     THEN CASE d::text WHEN 'for' THEN 'CF' WHEN 'against' THEN 'CA' ELSE 'C' END
    WHEN 'warrant'   THEN 'W'
    WHEN 'evidence'  THEN 'E'
    WHEN 'impact'    THEN 'I'
    WHEN 'rebuttal'  THEN 'RB'
    WHEN 'turn'      THEN 'T'
  END
$$;

CREATE OR REPLACE FUNCTION next_stat_ref(res UUID, prefix TEXT)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT prefix || (COALESCE(MAX(substring(stat_ref FROM '[0-9]+$')::int), 0) + 1)
  FROM   statements
  WHERE  resolution_id = res AND stat_ref ~ ('^' || prefix || '[0-9]+$')
$$;

CREATE OR REPLACE FUNCTION assign_stat_ref() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p TEXT;
BEGIN
  p := stat_ref_prefix(NEW.stat_type, NEW.stat_direction);
  IF p IS NULL THEN RETURN NEW; END IF;
  -- Serialise numbering within one debate so concurrent inserts can't collide
  PERFORM pg_advisory_xact_lock(hashtext('stat_ref:' || NEW.resolution_id::text));
  NEW.stat_ref := next_stat_ref(NEW.resolution_id, p);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_stat_ref ON statements;
CREATE TRIGGER trg_assign_stat_ref
  BEFORE INSERT ON statements
  FOR EACH ROW
  WHEN (NEW.stat_ref IS NULL AND NEW.resolution_id IS NOT NULL AND NEW.stat_type <> 'resolution')
  EXECUTE FUNCTION assign_stat_ref();

-- ── Backfill ─────────────────────────────────────────────────
-- 1. Keep codes already written at the start of a description ("[CF2] …"), where
--    the code matches the statement's type and isn't used twice in the debate.
WITH parsed AS (
  SELECT id, resolution_id,
         substring(stat_description FROM '^\[([A-Z]{1,2}[0-9]+)\]') AS code,
         stat_ref_prefix(stat_type, stat_direction) AS prefix
  FROM   statements
  WHERE  stat_ref IS NULL AND resolution_id IS NOT NULL AND stat_type <> 'resolution'
), ok AS (
  SELECT id, code,
         COUNT(*) OVER (PARTITION BY resolution_id, code) AS uses
  FROM   parsed
  WHERE  code ~ ('^' || prefix || '[0-9]+$')
)
UPDATE statements s SET stat_ref = ok.code
FROM   ok WHERE ok.id = s.id AND ok.uses = 1;

-- 2. Number everything else in creation order, continuing after any kept codes.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, resolution_id, stat_ref_prefix(stat_type, stat_direction) AS prefix
    FROM   statements
    WHERE  stat_ref IS NULL AND resolution_id IS NOT NULL AND stat_type <> 'resolution'
    ORDER  BY resolution_id, created_at, id
  LOOP
    CONTINUE WHEN r.prefix IS NULL;
    UPDATE statements SET stat_ref = next_stat_ref(r.resolution_id, r.prefix) WHERE id = r.id;
  END LOOP;
END $$;

-- 3. The reference is now shown by the app, so drop the hand-typed copy from the
--    start of descriptions where it matches ("[CF2] Warming is…" → "Warming is…").
UPDATE statements
SET    stat_description = regexp_replace(stat_description, '^\[' || stat_ref || '\]\s*', '')
WHERE  stat_ref IS NOT NULL AND stat_description LIKE '[' || stat_ref || ']%';
