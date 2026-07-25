-- ============================================================
-- debate-report database schema
-- PostgreSQL 14+
--
-- First run:
--   createdb debate_report
--   psql -d debate_report -f db/schema.sql
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

CREATE TYPE user_status_t       AS ENUM ('active', 'suspended', 'closed');
CREATE TYPE stat_type_t         AS ENUM ('resolution', 'claim', 'warrant', 'evidence', 'rebuttal');
CREATE TYPE direction_t         AS ENUM ('for', 'against');
CREATE TYPE general_status_t    AS ENUM ('active', 'closed', 'deleted');
CREATE TYPE approval_status_t   AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE forum_type_t        AS ENUM ('public', 'private');
CREATE TYPE forum_visibility_t  AS ENUM ('public', 'hidden', 'apply_to_join');
CREATE TYPE member_role_t       AS ENUM ('debater', 'voter', 'moderator', 'sysadmin');
CREATE TYPE member_status_t     AS ENUM ('active', 'pending', 'suspended', 'removed');
CREATE TYPE vote_type_t         AS ENUM ('agree', 'disagree');
CREATE TYPE subject_area_t      AS ENUM (
    'culture', 'economics', 'education', 'environment', 'future',
    'health', 'history', 'law', 'media', 'philosophy', 'politics', 'science'
);
CREATE TYPE flag_status_t       AS ENUM ('for_review', 'reviewed', 'dismissed', 'actioned');
CREATE TYPE sys_alert_type_t    AS ENUM ('offensive', 'spam', 'misinformation', 'other');
CREATE TYPE scan_status_t       AS ENUM ('pending', 'complete', 'failed');
CREATE TYPE invitation_status_t AS ENUM ('open', 'paused', 'expired');
CREATE TYPE plan_frequency_t    AS ENUM ('monthly', 'annual');
CREATE TYPE fallacy_type_t      AS ENUM ('formal', 'informal');
CREATE TYPE stat_gen_status_t   AS ENUM ('pending', 'generating', 'complete', 'failed');
CREATE TYPE job_side_t          AS ENUM ('for', 'against');
CREATE TYPE job_item_type_t     AS ENUM ('claim', 'warrant', 'evidence', 'rebuttal');
CREATE TYPE ref_side_t          AS ENUM ('supporting', 'opposing');

-- ── Auto-update trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION add_updated_at(tbl TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format(
        'CREATE TRIGGER trg_%I_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        tbl, tbl
    );
END;
$$;

-- ── 1. users ─────────────────────────────────────────────────

CREATE TABLE users (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    email               TEXT         UNIQUE,         -- null for incognito users
    password_hash       TEXT,                       -- null for access-code-only users
    access_code         TEXT         UNIQUE,        -- bcrypt hash; null for email-auth users
    nostr_npub          TEXT         UNIQUE,        -- future Nostr login
    user_tier           TEXT         NOT NULL DEFAULT 'family'
                            CHECK (user_tier IN ('family', 'debater', 'moderator', 'sysadmin')),
    user_handle         TEXT         NOT NULL UNIQUE,
    user_full_name      TEXT,
    user_bio            TEXT,
    user_mobile         TEXT,
    user_country        TEXT,                       -- ISO 3166-1 alpha-2
    user_status         user_status_t NOT NULL DEFAULT 'active',
    bio_public          BOOLEAN      NOT NULL DEFAULT FALSE,
    newsletter          BOOLEAN      NOT NULL DEFAULT FALSE,
    terms_agreed        BOOLEAN      NOT NULL DEFAULT FALSE,
    is_sys_admin        BOOLEAN      NOT NULL DEFAULT FALSE,
    date_activated      TIMESTAMPTZ,
    last_statement_id   UUID,                       -- FK added after statements

    -- AI job tracking (denormalised for quick status display)
    user_job            TEXT,
    user_job_created    TIMESTAMPTZ,
    user_job_status     TEXT,

    CONSTRAINT users_has_auth CHECK (password_hash IS NOT NULL OR access_code IS NOT NULL)
);
SELECT add_updated_at('users');

-- ── 2. debate_forums ─────────────────────────────────────────

CREATE TABLE debate_forums (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    forum_title         TEXT         NOT NULL,
    forum_description   TEXT,
    forum_type          forum_type_t  NOT NULL DEFAULT 'public',
    forum_visibility    forum_visibility_t NOT NULL DEFAULT 'public',
    forum_status        general_status_t   NOT NULL DEFAULT 'active',
    forum_owner         UUID         NOT NULL REFERENCES users(id)
);
SELECT add_updated_at('debate_forums');

-- ── 3. statements (core table) ───────────────────────────────

CREATE TABLE statements (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    stat_type           stat_type_t  NOT NULL,
    stat_title          TEXT         NOT NULL,
    stat_description    TEXT,
    stat_status         general_status_t NOT NULL DEFAULT 'active',
    stat_direction      direction_t,              -- null for Resolutions
    subject_area        subject_area_t,
    forum_visibility    forum_visibility_t NOT NULL DEFAULT 'public',

    forum_id            UUID         REFERENCES debate_forums(id),
    forum_title_cache   TEXT,                     -- denormalised for display
    resolution_id       UUID         REFERENCES statements(id),  -- null for Resolutions
    debate_job_id       UUID,                     -- FK added after debate_jobs
    science_analysis_id UUID,                     -- FK added after science_analyses

    external_links      TEXT[]       NOT NULL DEFAULT '{}',

    -- Rebuttal-specific
    refute_ind          BOOLEAN,

    -- Moderator closing summary
    closing_statement   TEXT,

    -- Running vote totals (updated by server-side workflow on each vote)
    vote_for            INTEGER      NOT NULL DEFAULT 0,
    vote_against        INTEGER      NOT NULL DEFAULT 0,
    vote_total_for      INTEGER      NOT NULL DEFAULT 0,   -- includes child roll-up
    vote_total_against  INTEGER      NOT NULL DEFAULT 0,

    -- System-calculated metrics
    metric_impact       NUMERIC(5,2),
    metric_interest     NUMERIC(5,2),
    metric_weight       NUMERIC(5,2),
    metric_weight_for   NUMERIC(5,2),
    metric_weight_against NUMERIC(5,2),

    -- ReactFlow node display overrides
    node_custom_json    JSONB
);
SELECT add_updated_at('statements');

CREATE INDEX idx_statements_resolution ON statements(resolution_id);
CREATE INDEX idx_statements_forum      ON statements(forum_id);
CREATE INDEX idx_statements_type       ON statements(stat_type);
CREATE INDEX idx_statements_subject    ON statements(subject_area);
CREATE INDEX idx_statements_created_by ON statements(created_by);
CREATE INDEX idx_statements_status     ON statements(stat_status);

-- ── 4. stat_relationships ────────────────────────────────────
-- Graph edges: statement A is supported by statement B

CREATE TABLE stat_relationships (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    stat_id_supported    UUID        NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    stat_id_supported_by UUID        NOT NULL REFERENCES statements(id) ON DELETE CASCADE,

    UNIQUE (stat_id_supported, stat_id_supported_by)
);

CREATE INDEX idx_stat_rel_supported    ON stat_relationships(stat_id_supported);
CREATE INDEX idx_stat_rel_supported_by ON stat_relationships(stat_id_supported_by);

-- ── 5. stat_votes ────────────────────────────────────────────

CREATE TABLE stat_votes (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    statement_id        UUID         NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    vote                vote_type_t  NOT NULL,
    vote_debate_impact  SMALLINT     CHECK (vote_debate_impact BETWEEN 0 AND 10),
    vote_rationale      TEXT,

    UNIQUE (statement_id, created_by)   -- one vote per user per statement
);
SELECT add_updated_at('stat_votes');

CREATE INDEX idx_stat_votes_statement ON stat_votes(statement_id);
CREATE INDEX idx_stat_votes_user      ON stat_votes(created_by);

-- ── 6. stat_favs ─────────────────────────────────────────────

CREATE TABLE stat_favs (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    statement_id        UUID         NOT NULL REFERENCES statements(id) ON DELETE CASCADE,

    UNIQUE (statement_id, created_by)
);

CREATE INDEX idx_stat_favs_user ON stat_favs(created_by);

-- ── 7. fallacies ─────────────────────────────────────────────

CREATE TABLE fallacies (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    fallacy_name        TEXT         NOT NULL UNIQUE,
    fallacy_description TEXT,
    fallacy_example     TEXT,
    fallacy_type        fallacy_type_t NOT NULL
);

-- ── 8. statement_fallacies ───────────────────────────────────

CREATE TABLE statement_fallacies (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    statement_id        UUID         NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    fallacy_id          UUID         NOT NULL REFERENCES fallacies(id),
    fallacy_comment     TEXT
);

CREATE INDEX idx_stmt_fallacies_statement ON statement_fallacies(statement_id);

-- ── 9. comments ──────────────────────────────────────────────

CREATE TABLE comments (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    statement_id        UUID         NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    parent_id           UUID         REFERENCES comments(id),  -- threaded replies
    comment_title       TEXT,
    comment_body        TEXT         NOT NULL,
    comment_status      approval_status_t NOT NULL DEFAULT 'pending',
    moderator_id        UUID         REFERENCES users(id),
    moderator_review    TEXT
);
SELECT add_updated_at('comments');

CREATE INDEX idx_comments_statement ON comments(statement_id);
CREATE INDEX idx_comments_parent    ON comments(parent_id);

-- ── 10. forum_members ────────────────────────────────────────

CREATE TABLE forum_members (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    forum_id            UUID         NOT NULL REFERENCES debate_forums(id) ON DELETE CASCADE,
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_role         member_role_t NOT NULL DEFAULT 'debater',
    member_status       member_status_t NOT NULL DEFAULT 'pending',

    -- Stripe subscription (nullable — only for paid plans)
    subscription_plan_id UUID,                    -- FK added after subscription_plans
    stripe_customer_id   TEXT,
    stripe_sub_id        TEXT,
    stripe_sub_status    TEXT,
    stripe_price         TEXT,
    stripe_product       TEXT,
    stripe_period_start  TIMESTAMPTZ,
    stripe_period_end    TIMESTAMPTZ,

    UNIQUE (forum_id, user_id)
);
SELECT add_updated_at('forum_members');

CREATE INDEX idx_forum_members_user  ON forum_members(user_id);
CREATE INDEX idx_forum_members_forum ON forum_members(forum_id);

-- ── 11. invitations ──────────────────────────────────────────

CREATE TABLE invitations (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    forum_id            UUID         NOT NULL REFERENCES debate_forums(id) ON DELETE CASCADE,
    invited_role        member_role_t NOT NULL DEFAULT 'debater',
    invitation_status   invitation_status_t NOT NULL DEFAULT 'open',
    accessed_count      INTEGER      NOT NULL DEFAULT 0,
    accepted_count      INTEGER      NOT NULL DEFAULT 0,
    rejected_count      INTEGER      NOT NULL DEFAULT 0
);
SELECT add_updated_at('invitations');

-- ── 12. join_requests ────────────────────────────────────────

CREATE TABLE join_requests (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    forum_id            UUID         NOT NULL REFERENCES debate_forums(id) ON DELETE CASCADE,
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    join_message        TEXT,
    join_status         approval_status_t NOT NULL DEFAULT 'pending',

    UNIQUE (forum_id, user_id)
);
SELECT add_updated_at('join_requests');

-- ── 13. alert_flags ──────────────────────────────────────────

CREATE TABLE alert_flags (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    statement_id        UUID         REFERENCES statements(id) ON DELETE CASCADE,
    forum_id            UUID         REFERENCES debate_forums(id),
    review_owner        UUID         REFERENCES users(id),
    flag_type           sys_alert_type_t,
    flag_status         flag_status_t NOT NULL DEFAULT 'for_review',
    flag_text           TEXT
);
SELECT add_updated_at('alert_flags');

CREATE INDEX idx_alert_flags_statement ON alert_flags(statement_id);
CREATE INDEX idx_alert_flags_status    ON alert_flags(flag_status);

-- ── 14. alert_scans ──────────────────────────────────────────

CREATE TABLE alert_scans (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    statement_id        UUID         REFERENCES statements(id) ON DELETE CASCADE,
    forum_id            UUID         REFERENCES debate_forums(id),
    vote_id             UUID         REFERENCES stat_votes(id),
    review_owner        UUID         REFERENCES users(id),

    scan_status         scan_status_t NOT NULL DEFAULT 'pending',
    api_success         BOOLEAN,
    moderated_text      TEXT,
    scan_field          TEXT,             -- 'title', 'description', etc.
    has_profanity       BOOLEAN,
    has_hate_speech     BOOLEAN,
    has_pii             BOOLEAN
);
SELECT add_updated_at('alert_scans');

CREATE INDEX idx_alert_scans_statement ON alert_scans(statement_id);
CREATE INDEX idx_alert_scans_status    ON alert_scans(scan_status);

-- ── 15. debate_jobs ──────────────────────────────────────────

CREATE TABLE debate_jobs (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    resolution_id       UUID         REFERENCES statements(id),
    title               TEXT,
    description         TEXT,
    status              TEXT,             -- set by AI API webhook
    message             TEXT,
    error               TEXT,
    external_job_id     TEXT,             -- identifier from AI service
    webhook_url         TEXT
);
SELECT add_updated_at('debate_jobs');

-- ── 16. debate_job_items (normalised) ────────────────────────
-- Replaces ~60 flat columns in Bubble (for_claim_1_title, etc.)

CREATE TABLE debate_job_items (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    job_id              UUID         NOT NULL REFERENCES debate_jobs(id) ON DELETE CASCADE,
    side                job_side_t   NOT NULL,
    item_type           job_item_type_t NOT NULL,
    position            SMALLINT     NOT NULL CHECK (position BETWEEN 1 AND 4),
    title               TEXT,
    description         TEXT,
    strength            NUMERIC(4,2),
    gen_status          stat_gen_status_t NOT NULL DEFAULT 'pending',

    UNIQUE (job_id, side, item_type, position)
);
SELECT add_updated_at('debate_job_items');

-- ── 17. science_analyses ─────────────────────────────────────

CREATE TABLE science_analyses (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    statement_id        UUID         REFERENCES statements(id) ON DELETE CASCADE,
    claim               TEXT,
    pro_analysis        TEXT,
    con_analysis        TEXT,
    synthesis           TEXT
);
SELECT add_updated_at('science_analyses');

-- ── 18. science_analysis_refs (normalised) ───────────────────
-- Replaces 30 flat columns in Bubble (ref_supporting_1_link, etc.)

CREATE TABLE science_analysis_refs (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    analysis_id         UUID         NOT NULL REFERENCES science_analyses(id) ON DELETE CASCADE,
    side                ref_side_t   NOT NULL,
    position            SMALLINT     NOT NULL CHECK (position BETWEEN 1 AND 5),
    link                TEXT,
    summary             TEXT,
    title               TEXT,

    UNIQUE (analysis_id, side, position)
);

-- ── 19. newsletters ──────────────────────────────────────────

CREATE TABLE newsletters (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    created_by          UUID         NOT NULL REFERENCES users(id),

    news_title          TEXT         NOT NULL,
    news_issue          TEXT,
    news_letter         TEXT         NOT NULL,
    posted_date         DATE,
    news_hide           BOOLEAN      NOT NULL DEFAULT FALSE
);
SELECT add_updated_at('newsletters');

-- ── 20. website_messages ─────────────────────────────────────

CREATE TABLE website_messages (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    sender_name         TEXT,
    sender_email        TEXT         NOT NULL,
    sender_message      TEXT         NOT NULL
);

-- ── 21. debate_config (single-row global config) ─────────────

CREATE TABLE debate_config (
    id                  SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    sys_check_freq      TEXT,
    contention_high_threshold NUMERIC(5,2),
    sys_admin_start     DATE,
    sys_admin_end       DATE
);
SELECT add_updated_at('debate_config');
INSERT INTO debate_config DEFAULT VALUES;

-- ── 22. subscription_plans ───────────────────────────────────

CREATE TABLE subscription_plans (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    plan_name           TEXT         NOT NULL,
    plan_description    TEXT,
    plan_role           member_role_t NOT NULL,
    plan_frequency      plan_frequency_t NOT NULL,
    plan_cost_gbp       NUMERIC(8,2),
    plan_order          SMALLINT,
    stripe_plan_id      TEXT,
    stripe_price_id     TEXT
);
SELECT add_updated_at('subscription_plans');

-- ── Deferred / circular foreign keys ─────────────────────────

ALTER TABLE users
    ADD CONSTRAINT fk_users_last_statement
    FOREIGN KEY (last_statement_id) REFERENCES statements(id) ON DELETE SET NULL;

ALTER TABLE statements
    ADD CONSTRAINT fk_statements_debate_job
    FOREIGN KEY (debate_job_id) REFERENCES debate_jobs(id) ON DELETE SET NULL;

ALTER TABLE statements
    ADD CONSTRAINT fk_statements_science_analysis
    FOREIGN KEY (science_analysis_id) REFERENCES science_analyses(id) ON DELETE SET NULL;

ALTER TABLE forum_members
    ADD CONSTRAINT fk_forum_members_plan
    FOREIGN KEY (subscription_plan_id) REFERENCES subscription_plans(id) ON DELETE SET NULL;
