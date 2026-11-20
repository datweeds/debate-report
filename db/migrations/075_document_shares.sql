-- Share links: a document shared with people outside the Society, made by a moderator.
--   public   anyone with the link; the server serves the document itself.
--   private  the moderator's browser encrypted a copy with a random key that is
--            only in the link (after '#', never sent to us); we store that copy.
-- Only a hash of the link's token is stored, so the database can't rebuild links.

CREATE TABLE IF NOT EXISTS document_shares (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    customer_id     INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    token_hash      TEXT        NOT NULL UNIQUE,
    mode            TEXT        NOT NULL CHECK (mode IN ('public', 'private')),
    stored_name     TEXT,        -- private: the encrypted copy on disk
    size_bytes      BIGINT,
    expires_at      TIMESTAMPTZ,  -- NULL = no expiry (never for public links in private Societies)
    extended_at     TIMESTAMPTZ,
    created_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,
    open_count      INTEGER     NOT NULL DEFAULT 0,
    last_opened_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_document_shares_document ON document_shares (document_id) WHERE revoked_at IS NULL;
