CREATE TABLE IF NOT EXISTS sp_acts (
  id         SERIAL PRIMARY KEY,
  year       INT  NOT NULL,
  number     INT  NOT NULL,
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,
  pdf_url    TEXT,
  enacted_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, number)
);
CREATE INDEX IF NOT EXISTS sp_acts_year_idx       ON sp_acts (year DESC);
CREATE INDEX IF NOT EXISTS sp_acts_enacted_at_idx ON sp_acts (enacted_at DESC);
