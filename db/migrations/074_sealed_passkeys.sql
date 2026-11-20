-- Unlocking secure access (Sealed items) with a passkey instead of the recovery
-- phrase. The passkey's PRF output never leaves the person's device: it opens
-- `lock`, which holds their private key. `public_key` is the identity the lock
-- opens, so locks made before a reset are ignored (and are deleted by it).
CREATE TABLE IF NOT EXISTS user_sealed_passkeys (
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id  TEXT        NOT NULL,
    lock           TEXT        NOT NULL,
    public_key     TEXT        NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, credential_id)
);
