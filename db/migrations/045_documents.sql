-- Society Documents: files and links, in folders the moderators create.
-- Files live outside the public web folder (storage/documents) and are only
-- served through an access-checked route.

CREATE TABLE IF NOT EXISTS document_folders (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    parent_id    UUID        REFERENCES document_folders(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent ON document_folders (customer_id, parent_id);

CREATE TABLE IF NOT EXISTS documents (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    folder_id       UUID        REFERENCES document_folders(id) ON DELETE SET NULL,   -- NULL = top level
    kind            TEXT        NOT NULL CHECK (kind IN ('file', 'link')),
    title           TEXT        NOT NULL,
    description     TEXT,
    url             TEXT,        -- links
    file_name       TEXT,        -- files: the original name
    stored_name     TEXT,        -- files: name on disk
    mime_type       TEXT,
    size_bytes      BIGINT,
    uploaded_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    open_count      INTEGER     NOT NULL DEFAULT 0,   -- viewed in the browser, or link opened
    download_count  INTEGER     NOT NULL DEFAULT 0,   -- files saved
    deleted_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents (customer_id, folder_id) WHERE deleted_at IS NULL;
