-- Each document records whether it is sealed (its text and file encrypted in
-- members' browsers). A folder being sealed converts its documents one by one.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS protection TEXT NOT NULL DEFAULT 'server' CHECK (protection IN ('server', 'sealed'));
