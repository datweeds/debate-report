-- A sealed poll's questions are encrypted in members' browsers, so the server
-- keeps just how many there are (to open them one at a time in a live meeting).
ALTER TABLE society_polls ADD COLUMN IF NOT EXISTS question_count INTEGER;
