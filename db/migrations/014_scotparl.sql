-- 014_scotparl.sql — Scottish Parliament integration

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_scotparl_mod BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS sp_sync_log (
  id            SERIAL PRIMARY KEY,
  collection    TEXT NOT NULL,
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  record_count  INTEGER,
  error         TEXT
);

CREATE TABLE IF NOT EXISTS sp_sessions (
  id          INTEGER PRIMARY KEY,
  short_name  TEXT NOT NULL,
  name        TEXT NOT NULL,
  start_date  TIMESTAMPTZ,
  end_date    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sp_parties (
  id             INTEGER PRIMARY KEY,
  abbreviation   TEXT,
  actual_name    TEXT NOT NULL,
  preferred_name TEXT NOT NULL,
  valid_from     TIMESTAMPTZ,
  valid_until    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sp_bill_types (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sp_bill_stage_types (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL,
  bill_type_id INTEGER,
  sequence     INTEGER
);

CREATE TABLE IF NOT EXISTS sp_committees (
  id          INTEGER PRIMARY KEY,
  short_name  TEXT,
  name        TEXT NOT NULL,
  description TEXT,
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sp_members (
  person_id          INTEGER PRIMARY KEY,
  parliamentary_name TEXT NOT NULL,
  preferred_name     TEXT,
  photo_url          TEXT,
  is_current         BOOLEAN NOT NULL DEFAULT FALSE,
  gender_type_id     INTEGER,
  notes              TEXT
);

CREATE TABLE IF NOT EXISTS sp_member_parties (
  id          INTEGER PRIMARY KEY,
  person_id   INTEGER NOT NULL REFERENCES sp_members(person_id),
  party_id    INTEGER NOT NULL REFERENCES sp_parties(id),
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sp_bills (
  id                       INTEGER PRIMARY KEY,
  reference                TEXT,
  short_name               TEXT NOT NULL,
  full_name                TEXT NOT NULL,
  bill_type_id             INTEGER REFERENCES sp_bill_types(id),
  person_id                INTEGER REFERENCES sp_members(person_id),
  third_party_organisation TEXT
);

CREATE TABLE IF NOT EXISTS sp_bill_stages (
  id                 INTEGER PRIMARY KEY,
  bill_id            INTEGER NOT NULL REFERENCES sp_bills(id),
  bill_stage_type_id INTEGER REFERENCES sp_bill_stage_types(id),
  stage_date         TIMESTAMPTZ
);

-- Links SP bills to debate.report resolutions
CREATE TABLE IF NOT EXISTS sp_bill_debates (
  id            SERIAL PRIMARY KEY,
  sp_bill_id    INTEGER NOT NULL REFERENCES sp_bills(id),
  resolution_id UUID NOT NULL REFERENCES statements(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES users(id),
  UNIQUE(sp_bill_id, resolution_id)
);

CREATE INDEX IF NOT EXISTS idx_sp_bill_stages_bill_id    ON sp_bill_stages(bill_id);
CREATE INDEX IF NOT EXISTS idx_sp_member_parties_person  ON sp_member_parties(person_id);
CREATE INDEX IF NOT EXISTS idx_sp_bills_person_id        ON sp_bills(person_id);
CREATE INDEX IF NOT EXISTS idx_sp_bill_debates_bill_id   ON sp_bill_debates(sp_bill_id);
CREATE INDEX IF NOT EXISTS idx_sp_bill_debates_res_id    ON sp_bill_debates(resolution_id);
