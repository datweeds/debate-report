-- Browser and phone notifications (Web Push).

-- Each device (browser) a person has switched notifications on for.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint     TEXT        NOT NULL UNIQUE,
    p256dh       TEXT        NOT NULL,
    auth         TEXT        NOT NULL,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

-- What a person doesn't want to be notified about: kinds of item, and Societies.
CREATE TABLE IF NOT EXISTS push_prefs (
    user_id          UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    muted_kinds      TEXT[]      NOT NULL DEFAULT '{}',
    muted_societies  INTEGER[]   NOT NULL DEFAULT '{}',
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
