-- Versioned sets of New Society Principles
CREATE TABLE IF NOT EXISTS nsp_principle_sets (
  id          SERIAL PRIMARY KEY,
  version     INT NOT NULL,
  description TEXT,
  is_current  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  TEXT NOT NULL
);

-- Individual principles within a set
CREATE TABLE IF NOT EXISTS nsp_principles (
  id          SERIAL PRIMARY KEY,
  set_id      INT NOT NULL REFERENCES nsp_principle_sets(id) ON DELETE CASCADE,
  sort_order  INT NOT NULL DEFAULT 0,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  grounding   TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsp_principles_set ON nsp_principles(set_id, sort_order);

-- Review requests on individual principles
CREATE TABLE IF NOT EXISTS nsp_review_requests (
  id           SERIAL PRIMARY KEY,
  principle_id INT NOT NULL REFERENCES nsp_principles(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  user_handle  TEXT NOT NULL,
  request_text TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nsp_reviews_principle ON nsp_review_requests(principle_id);
