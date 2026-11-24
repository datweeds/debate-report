-- Age checks (wallet proof, face check on the device, ID document), started by a
-- trigger. A session lives 15 minutes; it holds a one-time key for the wallet's
-- encrypted answer, and is deleted once used or expired. Only the result is kept
-- on the member: band, method and date (users.age_source / age_check_method / age_checked_at).
CREATE TABLE IF NOT EXISTS age_check_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method       TEXT NOT NULL,            -- wallet | face
  state        JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes'
);
CREATE INDEX IF NOT EXISTS age_check_sessions_user_idx ON age_check_sessions (user_id);
