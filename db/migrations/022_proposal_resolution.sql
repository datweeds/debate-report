ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS next_action           TEXT CHECK (next_action IN ('closed', 'debate', 'vote')),
  ADD COLUMN IF NOT EXISTS next_action_statement TEXT,
  ADD COLUMN IF NOT EXISTS next_action_at        TIMESTAMPTZ;
