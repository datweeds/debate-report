-- Notes: a third kind of document, written on the site (a title and rich text).
-- body holds the note as HTML: encrypted with the Society key, or sealed in members' browsers.
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_kind_check;
ALTER TABLE documents ADD CONSTRAINT documents_kind_check CHECK (kind IN ('file', 'link', 'note'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS body TEXT;
