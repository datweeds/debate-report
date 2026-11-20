-- Newsletter authored in the app (replaces markdown posts + the Blog tab).
-- Topics are written first; an Issue gathers unused topics and is sent to
-- blog_subscribers. A topic belongs to at most one issue, so it can't be sent
-- twice; once its issue is sent, the issue and its topics are archived.
CREATE TABLE IF NOT EXISTS newsletter_issues (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title         TEXT        NOT NULL,                 -- e.g. "Issue 1 · December 2026"
    subject       TEXT,                                 -- email subject (default: the title)
    intro_html    TEXT        NOT NULL DEFAULT '',
    status        TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent')),
    sent_at       TIMESTAMPTZ,
    sent_count    INTEGER     NOT NULL DEFAULT 0,
    failed_count  INTEGER     NOT NULL DEFAULT 0,
    created_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter_topics (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT        NOT NULL,
    image_path  TEXT,
    topic_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    body_html   TEXT        NOT NULL DEFAULT '',
    issue_id    UUID        REFERENCES newsletter_issues(id) ON DELETE SET NULL,
    position    INTEGER     NOT NULL DEFAULT 0,
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_newsletter_topics_issue ON newsletter_topics (issue_id, position);
