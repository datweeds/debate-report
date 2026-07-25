-- Reference data — safe to re-run (uses ON CONFLICT DO NOTHING)
-- psql -h localhost -U debate_report -d debate_report -f db/seed.sql

-- Subscription plans (Stripe IDs to be filled in when Stripe is wired)
INSERT INTO subscription_plans (plan_name, plan_description, plan_role, plan_frequency, plan_cost_gbp, plan_order)
VALUES
  ('Family',          'One open debate at a time, up to 6 participants. Free forever.',  'moderator', 'monthly', 0.00,  1),
  ('Public Debater',  'Participate in unlimited public debates.',                        'debater',   'monthly', 4.99,  2),
  ('Moderator',       'Create unlimited debates and all Debater rights.',                'moderator', 'monthly', 9.99,  3)
ON CONFLICT DO NOTHING;

-- Default public forum (owned by first sysadmin — update forum_owner after creating admin user)
INSERT INTO debate_forums (id, created_by, forum_title, forum_description, forum_type, forum_visibility, forum_status, forum_owner)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'Public Forum',
  'The main public debate forum for debate.report',
  'public', 'public', 'active',
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT DO NOTHING;
