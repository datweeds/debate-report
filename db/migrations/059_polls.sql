-- Society Polls (from poll.voter.care): multi-question polls and quizzes that
-- members, or holders of one-use access codes, vote in.
--
-- Ballot secrecy: who voted (poll_participants) is kept apart from what they
-- voted (poll_ballots). A secret ballot carries only a keyed token, derived
-- from the master key, so the voter can replace it until the poll closes
-- while a copy of the database alone can't tie a ballot to a voter. Secret
-- ballots carry no timestamps. Named polls store the voter on the ballot.
-- Ballots are always encrypted with the Society's key, whatever its privacy.

CREATE TABLE IF NOT EXISTS society_polls (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  payload            TEXT        NOT NULL,              -- JSON: title, description, questions… (encrypted for private Societies)
  status             TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  close_mode         TEXT        NOT NULL DEFAULT 'manual' CHECK (close_mode IN ('manual', 'fixed')),
  closes_at          TIMESTAMPTZ,
  opened_at          TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  question_order     TEXT        NOT NULL DEFAULT 'all_at_once' CHECK (question_order IN ('all_at_once', 'sequential')),
  questions_revealed INTEGER     NOT NULL DEFAULT 0,    -- sequential: how many questions are open so far
  result_visibility  TEXT        NOT NULL DEFAULT 'after_close' CHECK (result_visibility IN ('live', 'after_close', 'never')),
  ballot_mode        TEXT        NOT NULL DEFAULT 'secret' CHECK (ballot_mode IN ('secret', 'named')),
  allow_revote       BOOLEAN     NOT NULL DEFAULT TRUE,
  is_quiz            BOOLEAN     NOT NULL DEFAULT FALSE,
  allow_codes        BOOLEAN     NOT NULL DEFAULT FALSE, -- people without an account may vote with a code
  members_may_vote   BOOLEAN     NOT NULL DEFAULT TRUE,
  vote_count         INTEGER     NOT NULL DEFAULT 0,    -- voters (not ballots): kept in step with poll_participants
  created_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_society_polls ON society_polls (customer_id, status) WHERE deleted_at IS NULL;

-- One-use access codes for people without an account. Only a hash is kept.
CREATE TABLE IF NOT EXISTS poll_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     UUID        NOT NULL REFERENCES society_polls(id) ON DELETE CASCADE,
  code_hash   TEXT        NOT NULL UNIQUE,
  label       TEXT,                                     -- who it was for (encrypted)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at     TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_poll_codes ON poll_codes (poll_id);

-- Who has voted: turnout, and one voter one vote. Not what they voted.
CREATE TABLE IF NOT EXISTS poll_participants (
  poll_id    UUID        NOT NULL REFERENCES society_polls(id) ON DELETE CASCADE,
  user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  code_id    UUID        REFERENCES poll_codes(id) ON DELETE SET NULL,
  voter_key  TEXT        NOT NULL,                      -- 'm:<user id>' or 'c:<code id>'
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, voter_key)
);

-- What was voted. A replaced ballot is kept (its receipt stays verifiable) but not counted.
CREATE TABLE IF NOT EXISTS poll_ballots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id       UUID        NOT NULL REFERENCES society_polls(id) ON DELETE CASCADE,
  ballot_token  TEXT        NOT NULL,                   -- keyed token of the voter (secret) or the voter key (named)
  user_id       UUID        REFERENCES users(id) ON DELETE SET NULL,  -- named polls only
  code_id       UUID        REFERENCES poll_codes(id) ON DELETE SET NULL,  -- named polls only
  response      TEXT        NOT NULL,                   -- encrypted JSON answers
  receipt_hash  TEXT        NOT NULL,                   -- SHA-256 of the voter's receipt
  superseded    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ                             -- named polls only
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_poll_ballot_current ON poll_ballots (poll_id, ballot_token) WHERE NOT superseded;
CREATE INDEX IF NOT EXISTS idx_poll_ballots ON poll_ballots (poll_id);

-- Section "seen" markers include polls
ALTER TABLE society_section_seen DROP CONSTRAINT IF EXISTS society_section_seen_section_check;
ALTER TABLE society_section_seen ADD CONSTRAINT society_section_seen_section_check
  CHECK (section IN ('debates', 'news', 'discussions', 'documents', 'events', 'projects', 'principles', 'polls'));
