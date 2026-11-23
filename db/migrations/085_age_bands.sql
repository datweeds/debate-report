-- Age bands (self-declared at sign-up) and the protections that use them.
--   users.age_band            '13-15' | '16-17' | '18+'; NULL for accounts made before bands
--   customers.youth_group     a Society Admin runs it as a youth group: members aged 13-15 may join its calls
--   content_alerts.involves_minor  the author or reporter is under 18: reviewed first
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_band TEXT
  CHECK (age_band IN ('13-15', '16-17', '18+'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS youth_group BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE content_alerts ADD COLUMN IF NOT EXISTS involves_minor BOOLEAN NOT NULL DEFAULT FALSE;
