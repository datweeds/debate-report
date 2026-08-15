-- Blog subscribers
CREATE TABLE IF NOT EXISTS blog_subscribers (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    email               TEXT         NOT NULL UNIQUE,
    name                TEXT,
    unsubscribe_token   TEXT         NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    active              BOOLEAN      NOT NULL DEFAULT true,
    unsubscribed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_blog_subscribers_token ON blog_subscribers(unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_blog_subscribers_active ON blog_subscribers(active);

-- Track which posts have been sent as newsletters
CREATE TABLE IF NOT EXISTS blog_sends (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    post_slug   TEXT         NOT NULL,
    sent_count  INT          NOT NULL DEFAULT 0,
    sent_by     UUID         REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_blog_sends_slug ON blog_sends(post_slug);
