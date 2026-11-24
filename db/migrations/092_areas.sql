-- Areas: one worldwide hierarchy of places (GeoNames, CC BY 4.0), for finding
-- local Societies. Ids: a country code ('GB'), a region ('GB.ENG'), a county
-- ('GB.ENG.I9') or a GeoNames place id ('2649730'). path is the ids from the
-- country down, joined by '/', so "inside" and "around" are prefix tests.
-- Members' own areas are never stored here: they stay on their devices.
CREATE TABLE IF NOT EXISTS areas (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  ascii_name   TEXT,
  level        TEXT NOT NULL CHECK (level IN ('country', 'state_county', 'city', 'town')),
  parent_id    TEXT,
  path         TEXT NOT NULL,
  label        TEXT NOT NULL,
  country_code TEXT NOT NULL,
  population   INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS areas_name_idx ON areas (lower(name) text_pattern_ops);
CREATE INDEX IF NOT EXISTS areas_ascii_idx ON areas (lower(ascii_name) text_pattern_ops);
CREATE INDEX IF NOT EXISTS areas_path_idx ON areas (path text_pattern_ops);

-- A Society's Area (optional; NULL = not local)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS area_id TEXT REFERENCES areas(id);
