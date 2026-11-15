-- When each person last looked at each section of each Society, for the
-- "new since you last looked" counts in the menu and Society tabs.
CREATE TABLE IF NOT EXISTS society_section_seen (
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    section      TEXT        NOT NULL CHECK (section IN ('debates', 'discussions', 'documents', 'events', 'projects', 'principles')),
    seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, customer_id, section)
);
