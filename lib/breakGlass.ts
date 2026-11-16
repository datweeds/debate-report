// Sys Admin "break-glass" access to private Societies. Server-only.
//
// Sys Admin has no routine access to a private (apply/invite) Society's
// content. To see it (e.g. to investigate a serious report), they open a
// time-limited grant with a stated reason. Every grant is logged, shown to
// the Society's moderators, and emailed to the Society's contact address.

import pool from './db';
import type { SessionPayload } from './auth';
import { sendContactNotification } from './postmark';

export const GRANT_MINUTES = 60;

export async function activeGrant(session: SessionPayload | null, customerId: number): Promise<{ id: string; expires_at: string } | null> {
  if (!session?.isSysAdmin) return null;
  const { rows: [g] } = await pool.query(
    `SELECT id, expires_at FROM sysadmin_access
     WHERE customer_id = $1 AND user_id = $2 AND ended_at IS NULL AND expires_at > now()
     ORDER BY expires_at DESC LIMIT 1`, [customerId, session.sub]);
  return g ?? null;
}

// May Sys Admin act on this Society's content (read, take down)? Public
// Societies and content outside any Society: yes. Private ones: only during
// a break-glass grant.
export async function sysAdminMayAct(session: SessionPayload | null, customerId: number | null): Promise<boolean> {
  if (!session?.isSysAdmin) return false;
  if (customerId == null) return true;
  const { rows: [c] } = await pool.query('SELECT visibility FROM customers WHERE id = $1', [customerId]);
  if (!c || c.visibility === 'public') return true;
  return !!(await activeGrant(session, customerId));
}

// SQL: the viewer ($uid, text) is a SysAdmin allowed into Society `cid` — a
// public Society, or a private one with an active grant. Callers check
// isSysAdmin themselves.
export function sysAdminSocietySql(cid: string, uid: string): string {
  return `(${cid} IS NULL OR EXISTS (SELECT 1 FROM customers sxa WHERE sxa.id = ${cid} AND (sxa.visibility = 'public'
    OR EXISTS (SELECT 1 FROM sysadmin_access g WHERE g.customer_id = sxa.id AND g.user_id::text = ${uid}
               AND g.ended_at IS NULL AND g.expires_at > now()))))`;
}

export async function openGrant(session: SessionPayload, customerId: number, reason: string) {
  const { rows: [g] } = await pool.query(
    `INSERT INTO sysadmin_access (customer_id, user_id, reason, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4)) RETURNING id, expires_at`,
    [customerId, session.sub, reason, GRANT_MINUTES]);
  // Tell the Society
  const { rows: [c] } = await pool.query('SELECT name, contact_email FROM customers WHERE id = $1', [customerId]);
  if (c?.contact_email) {
    void sendContactNotification({
      name: 'new.vote', email: 'contact@new.vote', to: c.contact_email,
      subject: `Emergency Sys Admin access to ${c.name}`,
      message: `A new.vote Sys Admin (@${session.handle}) opened emergency access to your Society's content for ${GRANT_MINUTES} minutes.\n\nReason given: ${reason}\n\nThis access is logged and listed under Manage Society → Sys Admin access log.`,
      context: 'new.vote privacy notices',
    }).catch(err => console.error('[break-glass] notify', err));
  }
  return g;
}

export async function endGrant(session: SessionPayload, customerId: number) {
  await pool.query(
    `UPDATE sysadmin_access SET ended_at = now()
     WHERE customer_id = $1 AND user_id = $2 AND ended_at IS NULL AND expires_at > now()`, [customerId, session.sub]);
}

export async function accessLog(customerId: number) {
  const { rows } = await pool.query(
    `SELECT g.id, u.user_handle AS sysadmin, g.reason, g.created_at, g.expires_at, g.ended_at
     FROM sysadmin_access g LEFT JOIN users u ON u.id = g.user_id
     WHERE g.customer_id = $1 ORDER BY g.created_at DESC LIMIT 100`, [customerId]);
  return rows;
}
