-- Images refused at upload as sexually explicit: held encrypted (with a key
-- derived from the master key) for the platform team to review, then deleted
-- after 30 days, or kept a year when reported to the NCA (CSEA reporting rules).
CREATE TABLE IF NOT EXISTS quarantined_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id      UUID NOT NULL UNIQUE REFERENCES content_alerts(id) ON DELETE CASCADE,
  stored_name   TEXT NOT NULL,
  mime_type     TEXT,
  size_bytes    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  delete_after  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  nca_reference TEXT,
  reported_at   TIMESTAMPTZ,
  views         INTEGER NOT NULL DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  last_viewed_by UUID
);
CREATE INDEX IF NOT EXISTS quarantined_images_delete_after ON quarantined_images (delete_after);
