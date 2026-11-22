-- Site-wide settings a Sys Admin changes in the app (AI monthly cap, whether
-- plan limits are enforced, whether paid plans are on sale), and plan grants:
-- a plan given to a Society without a Stripe subscription (comped, charity,
-- lifetime, pay-what-you-can).

CREATE TABLE IF NOT EXISTS site_settings (
    key        TEXT        PRIMARY KEY,
    value      JSONB       NOT NULL,
    updated_by UUID        REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_grants (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    plan        TEXT        NOT NULL CHECK (plan IN ('society', 'society_plus')),
    until       TIMESTAMPTZ,                       -- NULL = no end date
    reason      TEXT        NOT NULL,
    granted_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_plan_grants_society ON plan_grants (customer_id) WHERE revoked_at IS NULL;
