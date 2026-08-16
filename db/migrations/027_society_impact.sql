-- Society Impact Analysis: AI-generated assessment of how a Bill or Proposal
-- strengthens or weakens each principle in a topic's current set.

CREATE TABLE IF NOT EXISTS society_impact_analyses (
  id               SERIAL PRIMARY KEY,
  tenant_id        INT  NOT NULL,
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('bill', 'proposal')),
  entity_id        INT  NOT NULL,
  topic_id         INT  NOT NULL REFERENCES nsp_topics(id) ON DELETE CASCADE,
  trigger_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  notes            TEXT,                         -- Topic Owner's contextual notes
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'done', 'failed')),
  overall_score    NUMERIC(4,2),                 -- mean of all principle scores
  report           JSONB,                        -- {summary, scores: [{principle_id, title, score, impacts}]}
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sia_unique ON society_impact_analyses(tenant_id, entity_type, entity_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_sia_entity ON society_impact_analyses(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sia_topic  ON society_impact_analyses(topic_id);
