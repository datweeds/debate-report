-- Society Projects: moderators create projects and appoint a Project Manager;
-- the PM breaks the work into a hierarchy of tasks and allocates members, who
-- file status reports. Members log Risks, Issues, Dependencies and Assumptions.
-- Dates are calendar dates (no time of day), so they mean the same everywhere.

CREATE TABLE IF NOT EXISTS projects (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    description  TEXT,
    manager_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
    status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'complete')),
    start_date   DATE,
    end_date     DATE,
    created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ,
    deleted_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_projects_society ON projects (customer_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS project_tasks (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id    UUID        REFERENCES project_tasks(id) ON DELETE CASCADE,
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    name         TEXT        NOT NULL,
    description  TEXT,
    start_date   DATE,
    end_date     DATE,
    due_date     DATE,
    status       TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'complete')),
    comments     TEXT,
    created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ,
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks (project_id, parent_id, sort_order);

CREATE TABLE IF NOT EXISTS project_task_assignees (
    task_id      UUID        NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS project_status_reports (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id      UUID        NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
    user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
    status       TEXT        NOT NULL CHECK (status IN ('new', 'in_progress', 'complete')),  -- task status when reported
    body         TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_reports_task ON project_status_reports (task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS project_raid (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id   UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    kind         TEXT        NOT NULL CHECK (kind IN ('risk', 'issue', 'dependency', 'assumption')),
    name         TEXT        NOT NULL,
    description  TEXT,
    impact       TEXT        NOT NULL DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high')),
    likelihood   TEXT        NOT NULL DEFAULT 'medium' CHECK (likelihood IN ('low', 'medium', 'high')),
    status       TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mitigated', 'closed')),
    created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_project_raid ON project_raid (project_id, kind);
