-- The master key that wraps private Societies' keys can be held off the
-- server and supplied after each restart. We keep only a fingerprint (to
-- check a key someone supplies is the right one) and a log of what was done.
CREATE TABLE IF NOT EXISTS master_key_state (
  id          BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  fingerprint TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS master_key_log (
  id         BIGSERIAL PRIMARY KEY,
  action     TEXT NOT NULL,   -- loaded | unlocked | locked | stored | removed | revealed | failed
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
