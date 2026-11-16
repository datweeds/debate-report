-- Members can report discussion messages. A report is an alert in the same
-- review queue as the scanner's, marked "reported", with who reported it and
-- why (the note is encrypted for private Societies, like the flagged text).
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS reported_by   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS report_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_content_alerts_reports ON content_alerts (content_type, content_key, reported_by) WHERE reported_by IS NOT NULL;
