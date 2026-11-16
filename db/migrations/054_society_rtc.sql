-- Audio and video rooms per Society (Meet tab), on the self-hosted LiveKit
-- server shared with Element Call (rtc.new.vote). No media is recorded.

CREATE TABLE IF NOT EXISTS society_rtc_rooms (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name             TEXT        NOT NULL,
    mode             TEXT        NOT NULL DEFAULT 'video' CHECK (mode IN ('video', 'audio')),
    max_participants INTEGER     NOT NULL DEFAULT 25 CHECK (max_participants BETWEEN 2 AND 50),
    is_default       BOOLEAN     NOT NULL DEFAULT FALSE,   -- the Society's standing room
    locked           BOOLEAN     NOT NULL DEFAULT FALSE,   -- no new joins except moderators
    created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_society_rtc_rooms ON society_rtc_rooms (customer_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_society_rtc_default ON society_rtc_rooms (customer_id) WHERE is_default AND deleted_at IS NULL;

-- People removed from a room and barred from rejoining it for a while
CREATE TABLE IF NOT EXISTS society_rtc_bans (
    room_id    UUID        NOT NULL REFERENCES society_rtc_rooms(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    until      TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (room_id, user_id)
);

-- Moderation actions and room events (no media, no message content)
CREATE TABLE IF NOT EXISTS society_rtc_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID        REFERENCES society_rtc_rooms(id) ON DELETE CASCADE,
    customer_id INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    actor       UUID        REFERENCES users(id) ON DELETE SET NULL,
    action      TEXT        NOT NULL,            -- join, mute, remove, lock, unlock, end, create, delete
    target      UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_society_rtc_log ON society_rtc_log (customer_id, created_at DESC);
