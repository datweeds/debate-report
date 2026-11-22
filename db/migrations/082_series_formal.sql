-- Recurring events: each occurrence is an ordinary event, linked to its series
-- (so responses, calendar files, reports and export work as for any event).
CREATE TABLE IF NOT EXISTS society_event_series (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    rule        JSONB       NOT NULL,          -- { freq, interval, until?, count? } (lib/recurrence.ts)
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE society_events ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES society_event_series(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_society_events_series ON society_events (series_id, starts_at) WHERE series_id IS NOT NULL;

-- Formal ballots (AGMs, elections, constitutional votes): a voter roll fixed
-- when voting opens, quorum and majority rules, scrutineers, and a certified
-- result with an independent timestamp.
ALTER TABLE society_polls ADD COLUMN IF NOT EXISTS formal     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE society_polls ADD COLUMN IF NOT EXISTS quorum_pct INTEGER CHECK (quorum_pct BETWEEN 1 AND 100);
ALTER TABLE society_polls ADD COLUMN IF NOT EXISTS majority   TEXT    NOT NULL DEFAULT 'simple'
    CHECK (majority IN ('simple', 'two_thirds', 'three_quarters'));

-- Who may vote, fixed when a formal ballot opens: members ('m:<user>') and access codes ('c:<code>')
CREATE TABLE IF NOT EXISTS poll_roll (
    poll_id   UUID NOT NULL REFERENCES society_polls(id) ON DELETE CASCADE,
    voter_key TEXT NOT NULL,
    user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    code_id   UUID REFERENCES poll_codes(id) ON DELETE SET NULL,
    PRIMARY KEY (poll_id, voter_key)
);

-- Members appointed to oversee a formal ballot: they see turnout, run the
-- checks and read the certificate, but can't change anything
CREATE TABLE IF NOT EXISTS poll_scrutineers (
    poll_id  UUID        NOT NULL REFERENCES society_polls(id) ON DELETE CASCADE,
    user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by UUID        REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (poll_id, user_id)
);

-- The certified result: the exact document (encrypted for private Societies),
-- its SHA-256, and an RFC 3161 timestamp of that hash from an independent authority
CREATE TABLE IF NOT EXISTS poll_certificates (
    poll_id      UUID        PRIMARY KEY REFERENCES society_polls(id) ON DELETE CASCADE,
    document     TEXT        NOT NULL,
    digest       TEXT        NOT NULL,
    tsa_url      TEXT,
    tsa_response TEXT,                     -- base64 DER TimeStampResp
    tsa_time     TIMESTAMPTZ,
    certified_by UUID        REFERENCES users(id) ON DELETE SET NULL,
    certified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
