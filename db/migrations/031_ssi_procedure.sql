-- Procedure type for SSIs: negative (made by ministers, parliament can annul)
-- or affirmative (parliament must approve before it comes into force)
ALTER TABLE sp_ssis ADD COLUMN IF NOT EXISTS procedure TEXT
  CHECK (procedure IN ('negative', 'affirmative'));

-- Subject/category from the legislation.gov.uk Atom feed ukm:Subject field
ALTER TABLE sp_ssis ADD COLUMN IF NOT EXISTS subject TEXT;

CREATE INDEX IF NOT EXISTS sp_ssis_procedure_idx ON sp_ssis (procedure);
