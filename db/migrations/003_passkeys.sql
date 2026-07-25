-- Migration 003: passkeys table for WebAuthn/FIDO2 credentials
-- Idempotent — safe to re-run

CREATE TABLE IF NOT EXISTS passkeys (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id  TEXT         NOT NULL UNIQUE,  -- base64url-encoded credential ID
    public_key     BYTEA        NOT NULL,          -- COSE-encoded public key
    counter        BIGINT       NOT NULL DEFAULT 0,
    device_type    TEXT,                           -- 'singleDevice' | 'multiDevice'
    backed_up      BOOLEAN      NOT NULL DEFAULT FALSE,
    transports     TEXT[],
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    last_used_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);
