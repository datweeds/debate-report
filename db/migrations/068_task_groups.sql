-- Task Groups: a project's top-level tasks can be gathered into named groups
-- (sub-tasks stay with their parent). Names are encrypted in private Societies.
CREATE TABLE IF NOT EXISTS project_task_groups (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_task_groups_project ON project_task_groups (project_id, sort_order);
ALTER TABLE project_tasks ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES project_task_groups(id) ON DELETE SET NULL;
