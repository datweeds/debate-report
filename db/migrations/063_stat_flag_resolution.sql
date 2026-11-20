-- User-reported flags can now be closed by a moderator. A cleared flag stays
-- on record (who cleared it, when) but no longer counts as open.
ALTER TABLE stat_flags ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE stat_flags ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stat_flags_open ON stat_flags (stat_id) WHERE resolved_at IS NULL;
