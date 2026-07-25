-- Migration 002: replace family/debater/moderator tier set with
-- follower/voter/debater/moderator

-- Drop old constraint, add new one (idempotent)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_tier_check;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_user_tier_check
    CHECK (user_tier IN ('follower', 'voter', 'debater', 'moderator', 'sysadmin'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Migrate any existing family-tier users to moderator (safe to re-run)
UPDATE users SET user_tier = 'moderator' WHERE user_tier = 'family';

-- Change default (idempotent)
ALTER TABLE users ALTER COLUMN user_tier SET DEFAULT 'follower';

-- Refresh subscription plans
DELETE FROM subscription_plans;
INSERT INTO subscription_plans (plan_name, plan_description, plan_role, plan_frequency, plan_cost_gbp, plan_order)
VALUES
  ('Follower',          'Browse and read all public debates. Free forever.',                   'voter',     'monthly',  0.00, 1),
  ('Voter Monthly',     'Vote and chat on any public debate.',                                 'voter',     'monthly',  2.00, 2),
  ('Voter Annual',      'Vote and chat — 25% off with annual billing.',                        'voter',     'annual',   1.50, 3),
  ('Debater Monthly',   'Create statements, evidence and rebuttals in any public debate.',     'debater',   'monthly',  4.00, 4),
  ('Debater Annual',    'Full debater access — 25% off with annual billing.',                  'debater',   'annual',   3.00, 5),
  ('Moderator Monthly', 'Create debates, moderate, plus 5 family Voter seats.',               'moderator', 'monthly',  9.00, 6),
  ('Moderator Annual',  'Full moderator access — 25% off with annual billing.',               'moderator', 'annual',   6.75, 7);
