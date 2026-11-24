-- Societies carry topics (the same list as debates' topics), for finding them.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS customers_topics_idx ON customers USING gin (topics);
