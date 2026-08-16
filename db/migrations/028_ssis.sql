CREATE TABLE IF NOT EXISTS sp_ssis (
  id         SERIAL PRIMARY KEY,
  year       INT  NOT NULL,
  number     INT  NOT NULL,
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,
  pdf_url    TEXT,
  enacted_at DATE,
  heading    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (year, number)
);
CREATE INDEX IF NOT EXISTS sp_ssis_year_idx ON sp_ssis (year DESC);
CREATE INDEX IF NOT EXISTS sp_ssis_enacted_at_idx ON sp_ssis (enacted_at DESC);
