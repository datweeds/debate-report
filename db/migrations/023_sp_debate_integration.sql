-- ScotParl system forum (owned by first sysadmin)
INSERT INTO debate_forums (created_by, forum_owner, forum_title, forum_description, forum_type, forum_visibility, is_system_forum)
SELECT id, id,
  'ScotParl Debates',
  'Debates on Scottish Parliament bills and community proposals, initiated via the ScotParl section.',
  'public', 'public', true
FROM users WHERE is_sys_admin = true ORDER BY created_at LIMIT 1
ON CONFLICT DO NOTHING;

-- Debate requests (any logged-in user, for bills or proposals)
CREATE TABLE IF NOT EXISTS sp_debate_requests (
  id               SERIAL PRIMARY KEY,
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('bill', 'proposal')),
  entity_id        INT  NOT NULL,
  requester_id     TEXT NOT NULL,
  requester_handle TEXT NOT NULL,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'rejected', 'moved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sp_dreq_entity    ON sp_debate_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sp_dreq_requester ON sp_debate_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_sp_dreq_status    ON sp_debate_requests(status);

-- History of actions on requests (+ sysadmin direct-opens)
CREATE TABLE IF NOT EXISTS sp_debate_request_actions (
  id               SERIAL PRIMARY KEY,
  request_id       INT  REFERENCES sp_debate_requests(id) ON DELETE CASCADE,
  action           TEXT NOT NULL CHECK (action IN ('requested', 'rejected', 'moved_to_debate', 'direct_open')),
  actor_id         TEXT NOT NULL,
  actor_handle     TEXT NOT NULL,
  note             TEXT,
  resolution_id    UUID REFERENCES statements(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sp_dreq_act_req ON sp_debate_request_actions(request_id);

-- Proposal debates (mirrors sp_bill_debates)
CREATE TABLE IF NOT EXISTS sp_proposal_debates (
  id            SERIAL PRIMARY KEY,
  proposal_id   INT  NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  resolution_id UUID NOT NULL REFERENCES statements(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id),
  UNIQUE (proposal_id, resolution_id)
);

CREATE INDEX IF NOT EXISTS idx_sp_prop_debates_prop ON sp_proposal_debates(proposal_id);
