-- Migration 012: Stripe subscription fields on users table
-- (Stripe fields in forum_members were for a different purpose)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_sub_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_sub_status   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_period_end   TIMESTAMPTZ;
