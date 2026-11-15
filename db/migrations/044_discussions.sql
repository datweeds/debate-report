-- Society Discussions: general-purpose threads with replies and emoji reactions.

CREATE TABLE IF NOT EXISTS discussion_threads (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    title         TEXT        NOT NULL,
    created_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_post_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pinned        BOOLEAN     NOT NULL DEFAULT FALSE,
    locked        BOOLEAN     NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_discussion_threads_society
  ON discussion_threads (customer_id, pinned DESC, last_post_at DESC);

CREATE TABLE IF NOT EXISTS discussion_posts (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id   UUID        NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
    reply_to    UUID        REFERENCES discussion_posts(id) ON DELETE SET NULL,
    body        TEXT        NOT NULL,
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at   TIMESTAMPTZ,
    deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_thread ON discussion_posts (thread_id, created_at);

CREATE TABLE IF NOT EXISTS discussion_reactions (
    post_id     UUID        NOT NULL REFERENCES discussion_posts(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, user_id, emoji)
);
