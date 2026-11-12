-- External API access: tokened "parties" (e.g. a partner platform) who can create
-- statements on behalf of their own users. Each party's token is capped to a fixed
-- number of distinct external users; each external user maps 1:1 to a row in our
-- own `users` table so ownership checks ("only authors can edit their statements")
-- fall out of the existing created_by logic for free.

CREATE TABLE IF NOT EXISTS api_parties (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    token_hash  TEXT        NOT NULL UNIQUE,
    max_users   INTEGER     NOT NULL DEFAULT 10 CHECK (max_users > 0),
    created_by  UUID        REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS api_party_users (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    api_party_id      UUID        NOT NULL REFERENCES api_parties(id) ON DELETE CASCADE,
    external_user_id  TEXT        NOT NULL,
    user_id           UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (api_party_id, external_user_id)
);

CREATE INDEX IF NOT EXISTS idx_api_party_users_party ON api_party_users(api_party_id);
