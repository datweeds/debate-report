-- Migration 011: Close debate support
-- Adds resolution_decision and stat_hidden to statements

ALTER TABLE statements
  ADD COLUMN IF NOT EXISTS resolution_decision TEXT
    CHECK (resolution_decision IN ('for', 'against', 'draw')),
  ADD COLUMN IF NOT EXISTS stat_hidden BOOLEAN NOT NULL DEFAULT false;

-- stat_status already has 'closed' in general_status_t
-- closing_statement column already exists
-- vote_total_for / vote_total_against already exist
