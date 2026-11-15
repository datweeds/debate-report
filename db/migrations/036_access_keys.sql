-- Access Keys: SysAdmin-issued keys that let a named recipient view specific
-- content (currently debates) read-only, without an account. Separate from
-- passkey login. Only a SHA-256 hash of each key is stored; the key itself is
-- shown once at creation. Revoking (or expiry) cuts off access immediately,
-- since every request re-checks the key.

CREATE TABLE IF NOT EXISTS access_keys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash       TEXT NOT NULL UNIQUE,
  label          TEXT NOT NULL,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,
  revoked_at     TIMESTAMPTZ,
  first_used_at  TIMESTAMPTZ,
  last_used_at   TIMESTAMPTZ,
  use_count      INTEGER NOT NULL DEFAULT 0
);

-- What a key unlocks. One row per debate (resolution).
CREATE TABLE IF NOT EXISTS access_key_debates (
  key_id         UUID NOT NULL REFERENCES access_keys(id) ON DELETE CASCADE,
  resolution_id  UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  PRIMARY KEY (key_id, resolution_id)
);
CREATE INDEX IF NOT EXISTS access_key_debates_resolution_idx ON access_key_debates (resolution_id);
