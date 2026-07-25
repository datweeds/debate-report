-- Migration 001: user auth columns
-- Run on existing DB: psql -h localhost -U debate_report -d debate_report -f db/migrations/001_user_auth.sql

ALTER TABLE users
    ALTER COLUMN email DROP NOT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS user_tier   TEXT NOT NULL DEFAULT 'family'
        CHECK (user_tier IN ('family', 'debater', 'moderator', 'sysadmin'));

ALTER TABLE users
    ADD CONSTRAINT users_has_auth
    CHECK (password_hash IS NOT NULL OR access_code IS NOT NULL)
    NOT VALID;   -- NOT VALID skips checking existing rows (all existing rows have password_hash null anyway)
