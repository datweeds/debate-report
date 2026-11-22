-- Stripe billing for new.vote.
--
-- Pricing isn't settled, so nothing here names a plan. Prices live in Stripe
-- (lookup keys starting nv_, product metadata app=newvote, plan=<key>,
-- for=user|society). This table mirrors each subscription so the app can ask
-- "what does this person / Society have?" without calling Stripe.
--
-- A subscription belongs to exactly one person or one Society.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

CREATE TABLE IF NOT EXISTS billing_subscriptions (
    id                    TEXT        PRIMARY KEY,           -- Stripe subscription id
    stripe_customer_id    TEXT        NOT NULL,
    user_id               UUID        REFERENCES users(id) ON DELETE CASCADE,
    society_id            INTEGER     REFERENCES customers(id) ON DELETE CASCADE,
    started_by            UUID,                              -- who checked out (no FK: survives account deletion)
    status                TEXT        NOT NULL,              -- Stripe's: active, trialing, past_due, canceled…
    plan                  TEXT,                              -- product/price metadata "plan"
    price_id              TEXT,
    lookup_key            TEXT,
    quantity              INTEGER,
    current_period_end    TIMESTAMPTZ,
    cancel_at_period_end  BOOLEAN     NOT NULL DEFAULT FALSE,
    canceled_at           TIMESTAMPTZ,
    trial_end             TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (num_nonnulls(user_id, society_id) = 1)
);
CREATE INDEX IF NOT EXISTS idx_billing_subs_user    ON billing_subscriptions (user_id)    WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_subs_society ON billing_subscriptions (society_id) WHERE society_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_billing_subs_cust    ON billing_subscriptions (stripe_customer_id);

-- Webhook events already handled (Stripe can deliver one more than once)
CREATE TABLE IF NOT EXISTS billing_events (
    id           TEXT        PRIMARY KEY,                    -- Stripe event id
    type         TEXT        NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
