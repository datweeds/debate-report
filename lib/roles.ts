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

/**
 * True if the user moderates this Society (customer_roles 'customer_admin').
 * Moderator is the only role with rights over a Society's debates: creating,
 * editing, visibility, join requests, quality review. No SysAdmin bypass —
 * a SysAdmin who also moderates is a moderator of that Society too.
 */
export async function isSocietyModerator(session: SessionPayload | null, customerId: number | null | undefined): Promise<boolean> {
  if (!session || customerId == null) return false;
  return isCustomerAdmin(session.sub, customerId);
}

/** Society IDs this user moderates. */
export async function moderatedSocietyIds(userId: string): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT tenant_id FROM customer_roles WHERE user_id = $1 AND role = 'customer_admin'`,
    [userId],
  );
  return rows.map(r => r.tenant_id as number);
}

/** The Society a statement's debate belongs to. */
export async function statementSocietyId(statementId: string): Promise<number | null> {
  const { rows } = await pool.query(
    `SELECT COALESCE(r.customer_id, s.customer_id) AS customer_id
     FROM statements s LEFT JOIN statements r ON r.id = s.resolution_id
     WHERE s.id = $1`,
    [statementId],
  );
  return rows[0]?.customer_id ?? null;
}

/**
 * True if the user is SysAdmin, or moderates this Society. Used only for the
 * alert / flag review queue: SysAdmin keeps a platform-wide takedown backstop.
 */
export async function isSocietyAdmin(session: SessionPayload, customerId: number): Promise<boolean> {
  if (session.isSysAdmin) return true;
  return isCustomerAdmin(session.sub, customerId);
}

/**
 * True if the user may set a debate's visibility (public/apply/invite) for
 * the Society it belongs to. Deliberately narrower than canManageDebates —
 * only Society Admin or SysAdmin, not topic-owners or the debate's creator.
 */
export async function canSetDebateVisibility(session: SessionPayload, customerId: number): Promise<boolean> {
  return isSocietyModerator(session, customerId);
}
