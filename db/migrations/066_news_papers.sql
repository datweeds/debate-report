-- News: a Society can include scientific papers and preprints (published in
-- the last 90 days, matching its sections) in a research part of each edition.
ALTER TABLE society_news ADD COLUMN IF NOT EXISTS include_papers BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE society_news_editions ADD COLUMN IF NOT EXISTS papers JSONB NOT NULL DEFAULT '[]';
