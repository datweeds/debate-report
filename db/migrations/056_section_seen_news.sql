-- "New since you last looked" now covers the News tab too
ALTER TABLE society_section_seen DROP CONSTRAINT IF EXISTS society_section_seen_section_check;
ALTER TABLE society_section_seen ADD CONSTRAINT society_section_seen_section_check
    CHECK (section IN ('debates', 'news', 'discussions', 'documents', 'events', 'projects', 'principles'));
