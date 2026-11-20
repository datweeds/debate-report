-- Members' responses to Society events ("Planning to attend" / "Not coming"),
-- and who may see them, set by the event's author:
--   all     everyone in the Society sees who's coming
--   counts  members see the numbers only (the author and moderators see names)
--   author  only the event's author and moderators see the responses
--   off     the event doesn't ask for responses
ALTER TABLE society_events ADD COLUMN IF NOT EXISTS response_visibility TEXT NOT NULL DEFAULT 'counts'
  CHECK (response_visibility IN ('all', 'counts', 'author', 'off'));

CREATE TABLE IF NOT EXISTS event_responses (
    event_id    UUID        NOT NULL REFERENCES society_events(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response    TEXT        NOT NULL CHECK (response IN ('going', 'not_going')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_responses_user ON event_responses (user_id);
