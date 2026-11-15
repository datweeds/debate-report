-- Abuse scanning for all text, not just debates. A background sweep scans
-- new and changed text (tracked by a hash of what was last scanned), every
-- 15 minutes, as a full pass daily, and on demand from Admin.

-- Alerts now cover content outside debates: they carry their Society, a link
-- to where the content can be seen, and the content's id as text (Societies
-- have whole-number ids, everything else UUIDs).
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS customer_id  INTEGER REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS content_key  TEXT;
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS content_href TEXT;

UPDATE content_alerts ca
SET    customer_id  = r.customer_id,
       content_key  = ca.content_id::text,
       content_href = '/chamber?resolution=' || ca.resolution_id
FROM   statements r
WHERE  r.id = ca.resolution_id AND ca.content_key IS NULL;

CREATE INDEX IF NOT EXISTS idx_content_alerts_society ON content_alerts (customer_id, status);

-- What text has been scanned, so unchanged text isn't scanned (or alerted) twice
CREATE TABLE IF NOT EXISTS scanned_content (
    content_type  TEXT        NOT NULL,
    content_key   TEXT        NOT NULL,
    text_hash     TEXT        NOT NULL,
    scanned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (content_type, content_key)
);

-- One row per sweep, for the Admin scanning page
CREATE TABLE IF NOT EXISTS scan_runs (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    kind           TEXT        NOT NULL CHECK (kind IN ('interval', 'daily', 'manual')),
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at    TIMESTAMPTZ,
    items_scanned  INTEGER     NOT NULL DEFAULT 0,
    alerts_raised  INTEGER     NOT NULL DEFAULT 0,
    error          TEXT,
    started_by     UUID        REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_scan_runs_started ON scan_runs (started_at DESC);
