-- Dynamic "current customer" selection: sysAdmin picks one default customer
-- for logged-out visitors; any visitor can switch to another PUBLIC customer.
-- Also gives debates/resolutions real customer attribution (statements.customer_id),
-- replacing the previous "no attribution at all unless linked to a bill/proposal" gap.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Preserve current behaviour exactly: customer 1 (scotparl) is what TENANT_ID=1
-- already pointed at, so it becomes the explicit default.
UPDATE customers SET is_default = true
WHERE id = 1 AND NOT EXISTS (SELECT 1 FROM customers WHERE is_default = true);

ALTER TABLE statements ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);

-- Backfill resolutions already linked to a tenant via a bill or proposal debate.
UPDATE statements s
SET customer_id = sbd.tenant_id
FROM sp_bill_debates sbd
WHERE s.id = sbd.resolution_id AND s.stat_type = 'resolution' AND s.customer_id IS NULL;

UPDATE statements s
SET customer_id = spd.tenant_id
FROM sp_proposal_debates spd
WHERE s.id = spd.resolution_id AND s.stat_type = 'resolution' AND s.customer_id IS NULL;

-- Every other (standalone/legacy) resolution: attribute to the default customer
-- rather than leaving it unattributed.
UPDATE statements
SET customer_id = (SELECT id FROM customers WHERE is_default = true LIMIT 1)
WHERE stat_type = 'resolution' AND customer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_statements_customer_id ON statements(customer_id) WHERE stat_type = 'resolution';

-- Membership for PRIVATE societies ("Society" is the user-facing term for a
-- customer/tenant — code keeps the existing customers/tenant_id names since
-- renaming those would touch ~60 files; only display copy changes). Public
-- societies need no membership row — anyone can see/switch to them. A
-- sysadmin can always see every private society regardless of membership.
CREATE TABLE IF NOT EXISTS customer_members (
    customer_id INTEGER     NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (customer_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_members_user ON customer_members(user_id);
