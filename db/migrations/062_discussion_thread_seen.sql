-- When each person last opened each discussion thread, so the list can show
-- how many messages are new in it (e.g. on pinned threads).
CREATE TABLE IF NOT EXISTS discussion_thread_seen (
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id  UUID        NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE,
    seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, thread_id)
);
