-- Sealed items (end-to-end encryption in members' browsers; see lib/sealed/core.ts).

-- Each person's identity: their public key, and their private key locked in a
-- vault the server can't open (unlocked by their recovery phrase).
CREATE TABLE IF NOT EXISTS user_sealed_keys (
    user_id      UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    public_key   TEXT        NOT NULL,
    vault        TEXT        NOT NULL,
    phrase_lock  TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ
);

-- A sealed item's key for each epoch, locked separately for each member.
CREATE TABLE IF NOT EXISTS sealed_item_keys (
    item_type    TEXT        NOT NULL CHECK (item_type IN ('thread')),
    item_id      UUID        NOT NULL,
    epoch        INTEGER     NOT NULL CHECK (epoch >= 1),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    locked_key   TEXT        NOT NULL,
    locked_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (item_type, item_id, epoch, user_id)
);
CREATE INDEX IF NOT EXISTS idx_sealed_item_keys_user ON sealed_item_keys (user_id);

-- A Society's admins allow Sealed items; authors then choose per item.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS allow_sealed BOOLEAN NOT NULL DEFAULT false;

-- Discussion threads: 'server' (encrypted with the Society's key) or 'sealed'.
ALTER TABLE discussion_threads ADD COLUMN IF NOT EXISTS protection TEXT NOT NULL DEFAULT 'server'
    CHECK (protection IN ('server', 'sealed'));
ALTER TABLE discussion_threads ADD COLUMN IF NOT EXISTS sealed_epoch INTEGER;
