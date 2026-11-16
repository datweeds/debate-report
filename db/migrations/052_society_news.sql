-- A Society's News: its edition settings, the sections moderators define
-- (each a heading plus search phrases), and the editions received from the
-- News service (news.new.vote), kept as delivered.

CREATE TABLE IF NOT EXISTS society_news (
    customer_id     INTEGER     PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
    title           TEXT,                 -- NULL: "<Society> Daily News" / "Weekly News"
    cadence         TEXT        NOT NULL DEFAULT 'daily' CHECK (cadence IN ('daily', 'weekly')),
    publish_time    TEXT        NOT NULL DEFAULT '07:00' CHECK (publish_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    publish_weekday INTEGER     NOT NULL DEFAULT 0 CHECK (publish_weekday BETWEEN 0 AND 6),  -- 0 = Monday
    locations       JSONB       NOT NULL DEFAULT '[]',
    min_score       INTEGER     NOT NULL DEFAULT 35 CHECK (min_score BETWEEN 0 AND 100),
    max_items       INTEGER     NOT NULL DEFAULT 12 CHECK (max_items BETWEEN 1 AND 30),
    subscription_id UUID,                 -- in the News service
    webhook_secret  TEXT,                 -- checks editions pushed by the News service
    last_synced_at  TIMESTAMPTZ,
    last_read_at    TIMESTAMPTZ,          -- last time a reader was reported to News
    updated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS society_news_sections (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    heading      TEXT        NOT NULL,
    phrases      TEXT        NOT NULL,    -- one search phrase per line
    must_include TEXT,                    -- comma-separated words; at least one must appear
    must_exclude TEXT,                    -- comma-separated words; none may appear
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_society_news_sections ON society_news_sections (customer_id, sort_order);

CREATE TABLE IF NOT EXISTS society_news_editions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    digest_id    UUID        NOT NULL UNIQUE,  -- the News service's digest
    edition_date DATE        NOT NULL,
    cadence      TEXT        NOT NULL,
    overview     TEXT,
    items        JSONB       NOT NULL,
    item_count   INTEGER     NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_society_news_editions ON society_news_editions (customer_id, created_at DESC);
