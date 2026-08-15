CREATE TABLE IF NOT EXISTS nsp_topics (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  TEXT NOT NULL
);

ALTER TABLE nsp_principle_sets
  ADD COLUMN IF NOT EXISTS topic_id INT REFERENCES nsp_topics(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_nsp_sets_topic ON nsp_principle_sets(topic_id);
