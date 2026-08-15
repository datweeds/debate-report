CREATE TABLE IF NOT EXISTS sso_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client      TEXT        NOT NULL,
  redirect_to TEXT        NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '60 seconds',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sso_tokens_expires_at_idx ON sso_tokens (expires_at);
