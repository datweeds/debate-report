-- Moderation decisions carry a reason, shown to the author with how to appeal.
--   decision_reason     why it was masked (encrypted with the Society's key in private Societies)
--   author_notified_at  when the author was told (in the app, and by push if they allow it)
--   author_seen_at      when the author opened their Alerts & Flags page after that
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS decision_reason TEXT;
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS author_notified_at TIMESTAMPTZ;
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS author_seen_at TIMESTAMPTZ;
