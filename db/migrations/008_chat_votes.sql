-- Migration 008: Add is_deleted flag to comments (soft-delete for chat)
-- Run: psql $DATABASE_URL -f db/migrations/008_chat_votes.sql

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure default comment_status allows immediate visibility for chat messages
-- (new comments insert with 'accepted' explicitly so no change to enum needed)

-- Index for efficient chat message fetching
CREATE INDEX IF NOT EXISTS idx_comments_statement_deleted
  ON comments(statement_id, is_deleted);
