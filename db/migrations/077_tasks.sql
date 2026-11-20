-- Tasks: a member's quick to-do list in a Society, outside Projects. A task is
-- private to its author unless they share it (read-only) with everyone in the
-- Society or with chosen members. Categories are personal (each member's own,
-- and they can also tag Project Tasks with them); priorities are the Society's
-- (High / Medium / Low to start, moderators can change them). Text is encrypted
-- with the Society's key, in public Societies too.

CREATE TABLE IF NOT EXISTS task_priorities (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    color        TEXT        NOT NULL DEFAULT '#64748b',
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_priorities ON task_priorities (customer_id, sort_order);

CREATE TABLE IF NOT EXISTS society_tasks (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    number       INTEGER     NOT NULL,                 -- shown as T-0001, per Society
    owner_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    description  TEXT,                                 -- rich text (HTML)
    notes        TEXT,                                 -- rich text (HTML)
    status       TEXT        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'paused', 'complete')),
    priority_id  UUID        REFERENCES task_priorities(id) ON DELETE SET NULL,
    due_date     DATE,
    shared_all   BOOLEAN     NOT NULL DEFAULT FALSE,   -- everyone in the Society can see it
    converted_to UUID        REFERENCES project_tasks(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deleted_at   TIMESTAMPTZ,
    UNIQUE (customer_id, number)
);
CREATE INDEX IF NOT EXISTS idx_society_tasks_owner ON society_tasks (customer_id, owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_society_tasks_due ON society_tasks (customer_id, due_date) WHERE deleted_at IS NULL;

-- Chosen members a task is shared with (read-only)
CREATE TABLE IF NOT EXISTS task_shares (
    task_id      UUID        NOT NULL REFERENCES society_tasks(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_task_shares_user ON task_shares (user_id);

CREATE TABLE IF NOT EXISTS task_categories (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    owner_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         TEXT        NOT NULL,
    color        TEXT        NOT NULL DEFAULT '#64748b',
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_categories ON task_categories (customer_id, owner_id, sort_order);

-- A member's category on one of their tasks, or on a Project Task (only they see it)
CREATE TABLE IF NOT EXISTS task_category_links (
    category_id     UUID NOT NULL REFERENCES task_categories(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES society_tasks(id) ON DELETE CASCADE,
    project_task_id UUID REFERENCES project_tasks(id) ON DELETE CASCADE,
    CHECK ((task_id IS NULL) <> (project_task_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_cat_task ON task_category_links (category_id, task_id) WHERE task_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_task_cat_ptask ON task_category_links (category_id, project_task_id) WHERE project_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_cat_task ON task_category_links (task_id);
CREATE INDEX IF NOT EXISTS idx_task_cat_ptask ON task_category_links (project_task_id);

-- Project Tasks can be paused too, so both kinds of task filter the same way
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_status_check;
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_status_check CHECK (status IN ('new', 'in_progress', 'paused', 'complete'));
ALTER TABLE project_status_reports DROP CONSTRAINT IF EXISTS project_status_reports_status_check;
ALTER TABLE project_status_reports ADD CONSTRAINT project_status_reports_status_check CHECK (status IN ('new', 'in_progress', 'paused', 'complete'));
