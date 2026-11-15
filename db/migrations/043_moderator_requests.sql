-- Moderator is the paid role, but billing isn't live yet: users request it
-- and a SysAdmin approves. (Self-service tier changes no longer reach it.)
CREATE TABLE IF NOT EXISTS moderator_requests (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message     TEXT,
    status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    decided_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_moderator_request_pending
  ON moderator_requests (user_id) WHERE status = 'pending';
