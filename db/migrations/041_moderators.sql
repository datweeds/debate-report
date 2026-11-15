-- Moderator = the person who moderates a Society (customer_roles 'customer_admin').
-- SysAdmin no longer has debate rights by itself, so give every Society that has
-- no moderator one: the SysAdmin(s) on the Moderator tier who ran it until now.
INSERT INTO customer_roles (tenant_id, user_id, role)
SELECT c.id, u.id::text, 'customer_admin'
FROM   customers c
CROSS  JOIN users u
WHERE  u.is_sys_admin AND u.user_tier = 'moderator'
  AND  NOT EXISTS (SELECT 1 FROM customer_roles cr WHERE cr.tenant_id = c.id AND cr.role = 'customer_admin');

-- Moderators are members of the Societies they moderate.
INSERT INTO customer_members (customer_id, user_id)
SELECT cr.tenant_id, cr.user_id
FROM   customer_roles cr
WHERE  cr.role = 'customer_admin'
  AND  NOT EXISTS (SELECT 1 FROM customer_members m WHERE m.customer_id = cr.tenant_id AND m.user_id = cr.user_id);
