-- new.vote is 16+ (from 24 November 2026): there is no 13–15 age band.
-- Age signals (fixed rules on what members write), band-change history, and
-- the result of an age check (once checks exist). Never a date of birth.
UPDATE users SET age_band = '16-17' WHERE age_band = '13-15';

ALTER TABLE users ADD COLUMN IF NOT EXISTS age_source TEXT NOT NULL DEFAULT 'declared';   -- declared | checked
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_check_method TEXT;                          -- wallet | face | id_document
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_checked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_check_due TEXT;        -- why a check is needed (a rule id); NULL when none
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_hold_at TIMESTAMPTZ;   -- on hold while a possible under-16 is reviewed

CREATE TABLE IF NOT EXISTS age_band_changes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_band  TEXT,
  to_band    TEXT NOT NULL,
  changed_by TEXT NOT NULL DEFAULT 'member',   -- member | sysadmin | check
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS age_band_changes_user_idx ON age_band_changes (user_id, changed_at);

-- Which rule fired, never the words that matched
CREATE TABLE IF NOT EXISTS age_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id      TEXT NOT NULL,
  ruleset      INT NOT NULL,
  points       INT NOT NULL,
  content_type TEXT,
  content_key  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_id, content_type, content_key)
);
CREATE INDEX IF NOT EXISTS age_signals_user_idx ON age_signals (user_id, created_at);

-- Societies were never youth groups in use; the setting goes (column kept for old backups)
UPDATE customers SET youth_group = false WHERE youth_group;
