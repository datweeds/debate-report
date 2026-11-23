-- When someone agreed to the Society Admin procedure (asked when they start their first Society)
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_procedure_agreed_at TIMESTAMPTZ;
