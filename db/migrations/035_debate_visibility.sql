-- Collapse the old "Forum" concept (debate_forums + forum_members +
-- join_requests + invitations) into the Society model: every debate already
-- carries a real customer_id (034_customer_selection.sql), so per-debate
-- visibility (public/apply/invite) now lives directly on the debate itself,
-- scoped by its own Society, instead of a separate Forum entity.
--
-- Confirmed via live introspection before writing this migration: all 6
-- debate_forums rows are system-generated, only 1 is linked to any debate,
-- and forum_members/join_requests/invitations are empty system-wide — this
-- is a clean replace, not a data migration.

ALTER TABLE statements
  ADD COLUMN IF NOT EXISTS debate_visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (debate_visibility IN ('public', 'apply', 'invite'));

UPDATE statements SET debate_visibility = 'public' WHERE stat_type = 'resolution';

-- Replacements for forum_members / join_requests / invitations, keyed on the
-- debate itself (statements.id) instead of debate_forums.id. user_id is TEXT
-- to match the existing customer_members / customer_roles convention in this
-- codebase (users.id is UUID, but these join tables store it as text).

CREATE TABLE IF NOT EXISTS debate_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  member_status TEXT NOT NULL DEFAULT 'active' CHECK (member_status IN ('active', 'revoked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resolution_id, user_id)
);

CREATE TABLE IF NOT EXISTS debate_join_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'denied')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resolution_id, user_id)
);

CREATE TABLE IF NOT EXISTS debate_invitations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id  UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  created_by     UUID REFERENCES users(id),
  invitee_email  TEXT NOT NULL,
  token          TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Drop the old Forum apparatus (re-verified empty immediately before this
-- migration was run, not just at planning time).
DROP TABLE IF EXISTS join_requests;
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS forum_members;
DROP TABLE IF EXISTS debate_forums;

ALTER TABLE statements
  DROP COLUMN IF EXISTS forum_id,
  DROP COLUMN IF EXISTS forum_visibility,
  DROP COLUMN IF EXISTS forum_title_cache;
