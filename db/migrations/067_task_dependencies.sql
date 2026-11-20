-- A project task can depend on other tasks in the same project: it starts
-- after another task finishes ('finish'), or after another task starts ('start').
CREATE TABLE IF NOT EXISTS project_task_deps (
    task_id     UUID        NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    depends_on  UUID        NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    kind        TEXT        NOT NULL DEFAULT 'finish' CHECK (kind IN ('finish', 'start')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, depends_on),
    CHECK (task_id <> depends_on)
);
CREATE INDEX IF NOT EXISTS idx_project_task_deps_on ON project_task_deps (depends_on);
