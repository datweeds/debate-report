-- Migration 004: add image_path to statements
-- Idempotent

ALTER TABLE statements ADD COLUMN IF NOT EXISTS image_path TEXT;
