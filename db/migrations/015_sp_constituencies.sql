-- 015_sp_constituencies.sql — Wikidata-sourced MSP constituency data

CREATE TABLE IF NOT EXISTS sp_member_constituencies (
  person_id                 INTEGER PRIMARY KEY REFERENCES sp_members(person_id) ON DELETE CASCADE,
  constituency_name         TEXT NOT NULL,
  wikidata_person_qid       TEXT,
  wikidata_constituency_qid TEXT
);

CREATE INDEX IF NOT EXISTS idx_sp_member_const_name ON sp_member_constituencies(constituency_name);
