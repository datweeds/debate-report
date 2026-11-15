-- Private (Apply/Invite) debates an API party may read and write. Public debates
-- need no grant; non-public ones are closed to every token unless listed here.

CREATE TABLE IF NOT EXISTS api_party_debates (
    api_party_id   UUID        NOT NULL REFERENCES api_parties(id) ON DELETE CASCADE,
    resolution_id  UUID        NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (api_party_id, resolution_id)
);

-- Keep existing work going: grant each party the non-public debates its users
-- have already written in.
INSERT INTO api_party_debates (api_party_id, resolution_id)
SELECT DISTINCT apu.api_party_id, s.resolution_id
FROM   statements s
JOIN   api_party_users apu ON apu.user_id = s.created_by
JOIN   statements r ON r.id = s.resolution_id
WHERE  r.debate_visibility <> 'public'
ON CONFLICT DO NOTHING;
