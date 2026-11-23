-- Incidents and planned maintenance, posted by Sys Admin and shown on /status
CREATE TABLE IF NOT EXISTS status_incidents (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  impact      TEXT NOT NULL CHECK (impact IN ('outage', 'degraded', 'maintenance', 'security')),
  state       TEXT NOT NULL CHECK (state IN ('scheduled', 'investigating', 'identified', 'monitoring', 'resolved')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID
);
CREATE INDEX IF NOT EXISTS status_incidents_started ON status_incidents (started_at DESC);
