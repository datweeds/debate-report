CREATE TABLE proposals (
  id               SERIAL PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  topic_id         INT REFERENCES nsp_topics(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'proposed'
                   CHECK (status IN ('proposed', 'rejected', 'amended', 'accepted')),
  proposer_id      TEXT NOT NULL,
  proposer_handle  TEXT NOT NULL,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposals_proposer ON proposals(proposer_id);
CREATE INDEX idx_proposals_status   ON proposals(status);
CREATE INDEX idx_proposals_topic    ON proposals(topic_id);
