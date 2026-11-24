-- Age concerns raised in a Society (a "May be under 16" report, or a Society
-- Admin's concern about a member). Reviewed by the new.vote team only; the
-- Society's Admins see when, why (the note, encrypted with the Society's key in
-- private Societies) and the outcome, never the automatic age signals.
CREATE TABLE IF NOT EXISTS age_concerns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- the member it's about
  customer_id  INT REFERENCES customers(id) ON DELETE CASCADE,
  raised_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  raised_as    TEXT NOT NULL,          -- society_admin | member | visitor
  note         TEXT,
  item_kind    TEXT,                   -- what was reported (a post, an event…), if anything
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | no_concern | treated_16_17 | closed | checked_adult | checked_16_17
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS age_concerns_society_idx ON age_concerns (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS age_concerns_user_idx ON age_concerns (user_id) WHERE status = 'pending';
