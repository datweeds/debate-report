-- Society visibility, mirroring debate visibility:
--   public — anyone can see the Society and its public debates
--   apply  — listed to everyone; non-members see a teaser and can request to join
--   invite — invisible except to members (who joined through an invite link)
-- is_public becomes a computed column, so every existing reader keeps working.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'apply', 'invite'));
-- Existing private Societies were hidden from non-members: that is 'invite'
UPDATE customers SET visibility = CASE WHEN is_public THEN 'public' ELSE 'invite' END;

ALTER TABLE customers DROP COLUMN is_public;
ALTER TABLE customers ADD COLUMN is_public BOOLEAN GENERATED ALWAYS AS (visibility = 'public') STORED;

-- Who created the Society (a Moderator); they become its first moderator
ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE TABLE IF NOT EXISTS society_join_requests (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id      TEXT        NOT NULL,
    message      TEXT,
    status       TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by   TEXT,
    decided_at   TIMESTAMPTZ
);
-- One open request per person per Society
CREATE UNIQUE INDEX IF NOT EXISTS uq_society_join_pending
  ON society_join_requests (customer_id, user_id) WHERE status = 'pending';

-- Invite links a moderator sends; accepting one makes the (logged-in) user a member.
CREATE TABLE IF NOT EXISTS society_invites (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    token_hash   TEXT        NOT NULL UNIQUE,
    label        TEXT,
    created_by   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    use_count    INTEGER     NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_society_invites_customer ON society_invites (customer_id);
