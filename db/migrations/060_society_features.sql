-- Simple Societies: a Society's moderators switch each feature on or off.
-- Stored as the features switched OFF, so everything is on by default and
-- new features arrive switched on. Content is kept while a feature is off.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS disabled_sections TEXT[] NOT NULL DEFAULT '{}';
