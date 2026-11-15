-- Debate Quality Report: each run stores its findings so moderators can track
-- progress between runs (New / Still open / Resolved) and the score over time.

CREATE TABLE IF NOT EXISTS quality_reports (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    resolution_id    UUID        NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at      TIMESTAMPTZ,
    status           TEXT        NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running', 'complete', 'failed')),
    statement_count  INTEGER,
    score            INTEGER,
    ai_model         TEXT,
    ai_summary       TEXT,        -- the AI reviewer's overall assessment
    ai_error         TEXT         -- set when the rules ran but the AI review failed
);

CREATE INDEX IF NOT EXISTS idx_quality_reports_resolution
  ON quality_reports (resolution_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quality_findings (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID        NOT NULL REFERENCES quality_reports(id) ON DELETE CASCADE,
    source          TEXT        NOT NULL CHECK (source IN ('rules', 'ai')),
    rule_id         TEXT        NOT NULL,
    fingerprint     TEXT        NOT NULL,
    severity        TEXT        NOT NULL CHECK (severity IN ('critical', 'major', 'minor', 'suggestion')),
    category        TEXT        NOT NULL,
    statement_id    UUID        REFERENCES statements(id) ON DELETE SET NULL,
    stat_ref        TEXT,
    fallacy_name    TEXT,
    observation     TEXT        NOT NULL,
    recommendation  TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quality_findings_report ON quality_findings (report_id);

-- A moderator can dismiss a finding they disagree with; it stays dismissed on
-- later runs (matched by fingerprint) until un-dismissed.
CREATE TABLE IF NOT EXISTS quality_dismissals (
    resolution_id   UUID        NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    fingerprint     TEXT        NOT NULL,
    dismissed_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
    dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note            TEXT,
    observation     TEXT,       -- what was dismissed, so the AI can be told not to repeat it
    PRIMARY KEY (resolution_id, fingerprint)
);
