-- Society privacy:
-- 1. Sys Admin "break-glass" access to a private Society's content: only with
--    a stated reason, for a limited time, logged and shown to its moderators.
-- 2. Per-Society encryption at rest for private Societies' content. Each
--    Society has its own data key, stored wrapped (encrypted) by a master key
--    kept outside the database. Deleting a Society deletes its key, which
--    makes its encrypted content unrecoverable ("crypto-shredding").
-- 3. End-to-end encrypted Meet rooms (passphrase shared by members; the
--    server never sees it).

CREATE TABLE IF NOT EXISTS sysadmin_access (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    reason      TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    ended_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sysadmin_access ON sysadmin_access (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS society_keys (
    customer_id INTEGER     PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    wrapped_key TEXT        NOT NULL,     -- AES-256-GCM under SOCIETY_MASTER_KEY
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alerts keep a copy of flagged text; for private Societies it is encrypted,
-- so duplicates are found by a hash of the text instead of the text itself
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS text_hash TEXT;
UPDATE content_alerts SET text_hash = md5(flagged_text) WHERE text_hash IS NULL AND flagged_text IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_alerts_dedupe ON content_alerts (content_type, content_key, text_hash);

ALTER TABLE society_rtc_rooms ADD COLUMN IF NOT EXISTS e2ee BOOLEAN NOT NULL DEFAULT FALSE;
