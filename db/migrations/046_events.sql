-- Society calendar events, created by the Society's moderators.
CREATE TABLE IF NOT EXISTS society_events (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    title        TEXT        NOT NULL,
    description  TEXT,
    location     TEXT,        -- a place, or a link to an online meeting
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ,
    all_day      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ,
    deleted_at   TIMESTAMPTZ,
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX IF NOT EXISTS idx_society_events_time ON society_events (customer_id, starts_at) WHERE deleted_at IS NULL;
