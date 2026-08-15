import pool from './db';
import type { SessionPayload } from './auth';

export async function isCustomerAdmin(userId: string, tenantId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM customer_roles WHERE user_id = $1 AND tenant_id = $2 AND role = 'customer_admin' LIMIT 1`,
    [userId, tenantId]
  );
  return rows.length > 0;
}

export async function isTopicOwnerAny(userId: string, tenantId: number): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM topic_owners WHERE user_id = $1 AND tenant_id = $2 LIMIT 1`,
    [userId, tenantId]
  );
  return rows.length > 0;
}

export async function getOwnedTopicIds(userId: string, tenantId: number): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT topic_id FROM topic_owners WHERE user_id = $1 AND tenant_id = $2`,
    [userId, tenantId]
  );
  return rows.map(r => r.topic_id as number);
}

/** True if the user may open/approve/close debates for this tenant. */
export async function canManageDebates(session: SessionPayload, tenantId: number): Promise<boolean> {
  if (session.isSysAdmin) return true;
  return (
    await isCustomerAdmin(session.sub, tenantId) ||
    await isTopicOwnerAny(session.sub, tenantId)
  );
}
