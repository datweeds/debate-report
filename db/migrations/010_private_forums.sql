-- Migration 010: Private forum support
-- Addresses four gaps vs the private-forum spec:
--   1. Rename forum_visibility enum values to match spec language
--   2. Add response states to invitation_status_t + per-person magic-link columns
--   3. Flag system-allocated forums (auto-created at registration)
--   4. Add user_plan (free/paid) to users

-- ── 1. Rename forum_visibility enum values ────────────────────
-- 'hidden'        → 'invite'  (forum visible only to invited members)
-- 'apply_to_join' → 'apply'   (forum visible in Switchboard; users apply to join)
-- 'public'        stays as-is (Public House forum)

ALTER TYPE forum_visibility_t RENAME VALUE 'hidden'        TO 'invite';
ALTER TYPE forum_visibility_t RENAME VALUE 'apply_to_join' TO 'apply';

-- ── 2. Extend invitation_status_t with response states ────────
ALTER TYPE invitation_status_t ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE invitation_status_t ADD VALUE IF NOT EXISTS 'rejected';

-- Per-person magic-link columns on invitations
ALTER TABLE invitations
    ADD COLUMN IF NOT EXISTS token              TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS invitee_email      TEXT,
    ADD COLUMN IF NOT EXISTS invitation_message TEXT;

-- ── 3. System-allocated forum flag ───────────────────────────
-- Identifies the one forum auto-created for each user at registration.
-- is_system_forum = TRUE → visibility locked to 'invite', cannot be deleted.
ALTER TABLE debate_forums
    ADD COLUMN IF NOT EXISTS is_system_forum BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 4. Free / Paid plan on users ─────────────────────────────
-- 'free'  → one system-allocated private forum, max 6 invitations, own-forum debates only
-- 'paid'  → unlimited additional forums, public forum debate creation
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS user_plan TEXT NOT NULL DEFAULT 'free'
        CHECK (user_plan IN ('free', 'paid'));

-- Existing moderators become paid debaters
UPDATE users SET user_plan = 'paid' WHERE user_tier IN ('moderator', 'sysadmin');
UPDATE users SET user_plan = 'paid' WHERE is_sys_admin = TRUE;
