-- One Society can be the demo: always public, every debate public, and its
-- discussions readable without an account, so visitors can see new.vote at work.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_one_demo ON customers ((true)) WHERE is_demo;
