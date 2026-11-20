-- A project task can point at one of its Society's documents (a file or a link).
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL;
