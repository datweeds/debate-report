-- Society Principles: the rules, aspirations and guidelines a Society runs by.
-- Moderators maintain them in versions; members can request reviews, discuss
-- them and debate them. A SysAdmin-maintained library provides a starting set.

CREATE TABLE IF NOT EXISTS society_principle_versions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    version      INTEGER     NOT NULL,
    change_note  TEXT,
    is_current   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (customer_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_principle_version_current
  ON society_principle_versions (customer_id) WHERE is_current;

CREATE TABLE IF NOT EXISTS society_principles (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id  UUID        NOT NULL REFERENCES society_principle_versions(id) ON DELETE CASCADE,
    -- the same principle across versions shares a lineage id, so discussion
    -- threads and debates stay attached when a new version is published
    lineage_id  UUID        NOT NULL DEFAULT gen_random_uuid(),
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    category    TEXT        NOT NULL DEFAULT 'rule' CHECK (category IN ('rule', 'aspiration', 'guideline')),
    title       TEXT        NOT NULL,
    body        TEXT        NOT NULL,
    grounding   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_society_principles_version ON society_principles (version_id, sort_order);

-- Links that follow a principle across versions
CREATE TABLE IF NOT EXISTS society_principle_links (
    lineage_id     UUID    PRIMARY KEY,
    customer_id    INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    thread_id      UUID    REFERENCES discussion_threads(id) ON DELETE SET NULL,
    resolution_id  UUID    REFERENCES statements(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS society_principle_reviews (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    lineage_id   UUID        NOT NULL,
    user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
    request_text TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_principle_reviews ON society_principle_reviews (customer_id, lineage_id);

-- The general-purpose starting set, maintained by SysAdmin
CREATE TABLE IF NOT EXISTS principle_library (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    category    TEXT        NOT NULL DEFAULT 'rule' CHECK (category IN ('rule', 'aspiration', 'guideline')),
    title       TEXT        NOT NULL,
    body        TEXT        NOT NULL,
    grounding   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ
);

-- A draft starter set for SysAdmin to edit (only seeded if the library is empty)
INSERT INTO principle_library (sort_order, category, title, body, grounding)
SELECT * FROM (VALUES
  (1,  'rule',       'Debate the argument, not the person',
       'Challenge ideas, evidence and reasoning. Never attack, mock or label the people who hold them.',
       'Personal attacks end good-faith debate and drive people away; criticism of arguments improves them.'),
  (2,  'rule',       'Back claims with evidence',
       'Support factual claims with a source others can check, and say when something is your opinion.',
       'Shared evidence lets members weigh claims fairly, whichever side they are on.'),
  (3,  'rule',       'Argue in good faith',
       'Represent other people''s views accurately before you answer them, and concede points that are well made.',
       'Straw men and point-scoring waste everyone''s time and hide where the real disagreement lies.'),
  (4,  'rule',       'Respect privacy',
       'Don''t share anyone''s personal information, or content from private Societies, without their permission.',
       'Members must be able to take part without fear of being exposed.'),
  (5,  'rule',       'Declare your interests',
       'Say so if you have a personal, financial or professional stake in a question being debated.',
       'Interests don''t disqualify a view, but hidden ones undermine trust.'),
  (6,  'aspiration', 'Seek understanding as well as winning',
       'Aim to understand why others disagree, and to leave each debate knowing more than when you started.',
       'Debate that only seeks to win rarely changes minds, including our own.'),
  (7,  'aspiration', 'Make decisions in the open',
       'Decisions that affect the Society are proposed, debated and voted on where members can see them.',
       'Open decisions earn more trust and are easier to revisit when circumstances change.'),
  (8,  'aspiration', 'Welcome every member',
       'Make newcomers welcome, explain the Society''s ways of working, and keep language plain and inclusive.',
       'A Society is stronger when more voices can take part.'),
  (9,  'guideline',  'Moderate fairly and visibly',
       'Moderators apply these principles to everyone equally, explain their decisions, and allow appeals.',
       'Moderation that is consistent and explained is accepted; moderation that is not is resented.'),
  (10, 'guideline',  'Change these principles openly',
       'Any member may request a review of a principle. Changes are discussed, can be debated, and are published as a new version.',
       'Principles that members can question and improve stay relevant and are more likely to be followed.')
) AS v(sort_order, category, title, body, grounding)
WHERE NOT EXISTS (SELECT 1 FROM principle_library);
