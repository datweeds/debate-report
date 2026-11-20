-- Sealed items beyond discussions (see lib/sealed/core.ts).

ALTER TABLE sealed_item_keys DROP CONSTRAINT IF EXISTS sealed_item_keys_item_type_check;
ALTER TABLE sealed_item_keys ADD CONSTRAINT sealed_item_keys_item_type_check
    CHECK (item_type IN ('thread', 'calendar', 'principles', 'debates', 'project', 'folder', 'poll'));

-- A whole section of a Society sealed at once (its calendar, its principles, all
-- its debates). item_id names it in sealed_item_keys and in what is sealed.
CREATE TABLE IF NOT EXISTS society_sealed_sections (
    customer_id   INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    section       TEXT        NOT NULL CHECK (section IN ('calendar', 'principles', 'debates')),
    item_id       UUID        NOT NULL UNIQUE,
    sealed_epoch  INTEGER     NOT NULL DEFAULT 1,
    sealed_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
    sealed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (customer_id, section)
);

-- Single items that can be sealed with everything inside them
ALTER TABLE projects         ADD COLUMN IF NOT EXISTS protection TEXT NOT NULL DEFAULT 'server' CHECK (protection IN ('server', 'sealed'));
ALTER TABLE projects         ADD COLUMN IF NOT EXISTS sealed_epoch INTEGER;
ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS protection TEXT NOT NULL DEFAULT 'server' CHECK (protection IN ('server', 'sealed'));
ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS sealed_epoch INTEGER;
ALTER TABLE society_polls    ADD COLUMN IF NOT EXISTS protection TEXT NOT NULL DEFAULT 'server' CHECK (protection IN ('server', 'sealed'));
ALTER TABLE society_polls    ADD COLUMN IF NOT EXISTS sealed_epoch INTEGER;
