-- SP voting divisions
CREATE TABLE IF NOT EXISTS sp_divisions (
  id            SERIAL PRIMARY KEY,
  date          DATE NOT NULL,
  title         TEXT NOT NULL,
  for_count     INT NOT NULL DEFAULT 0,
  against_count INT NOT NULL DEFAULT 0,
  abstain_count INT NOT NULL DEFAULT 0,
  sp_bill_id    INT REFERENCES sp_bills(id) ON DELETE SET NULL,
  source_url    TEXT
);

CREATE INDEX IF NOT EXISTS idx_sp_divisions_bill  ON sp_divisions(sp_bill_id);
CREATE INDEX IF NOT EXISTS idx_sp_divisions_date  ON sp_divisions(date);

-- Per-MSP vote records
CREATE TABLE IF NOT EXISTS sp_division_votes (
  id          SERIAL PRIMARY KEY,
  division_id INT NOT NULL REFERENCES sp_divisions(id) ON DELETE CASCADE,
  person_id   INT REFERENCES sp_members(person_id) ON DELETE SET NULL,
  msp_name    TEXT NOT NULL,
  vote        TEXT NOT NULL CHECK (vote IN ('for', 'against', 'abstentions'))
);

CREATE INDEX IF NOT EXISTS idx_sp_div_votes_div    ON sp_division_votes(division_id);
CREATE INDEX IF NOT EXISTS idx_sp_div_votes_person ON sp_division_votes(person_id);
