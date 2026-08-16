-- User groups: CustomerAdmin can define groups (e.g. Committee, Common) and
-- assign registered users. Debates and votes can then be targeted at a group.

CREATE TABLE IF NOT EXISTS tenant_user_groups (
  id          SERIAL PRIMARY KEY,
  tenant_id   INT  NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS tenant_user_group_members (
  group_id  INT  NOT NULL REFERENCES tenant_user_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tugm_user  ON tenant_user_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tug_tenant ON tenant_user_groups(tenant_id);

-- Add group targeting to debate linking tables (NULL = visible to everyone)
ALTER TABLE sp_bill_debates        ADD COLUMN IF NOT EXISTS group_id INT REFERENCES tenant_user_groups(id) ON DELETE SET NULL;
ALTER TABLE sp_proposal_debates    ADD COLUMN IF NOT EXISTS group_id INT REFERENCES tenant_user_groups(id) ON DELETE SET NULL;
ALTER TABLE nsp_principle_debates  ADD COLUMN IF NOT EXISTS group_id INT REFERENCES tenant_user_groups(id) ON DELETE SET NULL;
ALTER TABLE sp_bill_pvc_polls      ADD COLUMN IF NOT EXISTS group_id INT REFERENCES tenant_user_groups(id) ON DELETE SET NULL;
ALTER TABLE proposals              ADD COLUMN IF NOT EXISTS pvc_poll_group_id INT REFERENCES tenant_user_groups(id) ON DELETE SET NULL;
ALTER TABLE nsp_principles         ADD COLUMN IF NOT EXISTS pvc_poll_group_id INT REFERENCES tenant_user_groups(id) ON DELETE SET NULL;
