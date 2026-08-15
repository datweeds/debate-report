-- Voter.care polls (stored in shared DB)
CREATE TABLE IF NOT EXISTS vc_polls (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  question    TEXT        NOT NULL,
  entity_type TEXT        NOT NULL CHECK (entity_type IN ('bill', 'proposal')),
  entity_id   INT         NOT NULL,
  entity_url  TEXT        NOT NULL,
  closes_at   TIMESTAMPTZ,
  status      TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_by  UUID        NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vc_votes (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   UUID        NOT NULL REFERENCES vc_polls(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES users(id),
  vote      BOOLEAN     NOT NULL,   -- true = For/Yes, false = Against/No
  voted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS sp_bill_polls (
  sp_bill_id INT  NOT NULL REFERENCES sp_bills(id),
  poll_id    UUID NOT NULL REFERENCES vc_polls(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (sp_bill_id, poll_id)
);

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS vote_poll_id UUID REFERENCES vc_polls(id);

CREATE INDEX IF NOT EXISTS vc_votes_poll_idx ON vc_votes (poll_id);
