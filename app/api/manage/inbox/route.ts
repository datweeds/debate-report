import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// GET — across every Society this user moderates: pending requests to join
// (for Join Requests) and invite links they can share (for Invitations).
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const mine = `SELECT tenant_id FROM customer_roles WHERE user_id = $1 AND role = 'customer_admin'`;
  const [{ rows: requests }, { rows: invites }] = await Promise.all([
    pool.query(
      `SELECT j.id, j.customer_id, c.name AS society_name, j.message, j.created_at,
              u.user_handle, u.user_full_name
       FROM society_join_requests j
       JOIN customers c ON c.id = j.customer_id
       LEFT JOIN users u ON u.id::text = j.user_id
       WHERE j.status = 'pending' AND j.customer_id IN (${mine})
       ORDER BY j.created_at`, [session.sub]),
    pool.query(
      `SELECT i.id, i.customer_id, c.name AS society_name, i.label, i.created_at, i.expires_at, i.use_count
       FROM society_invites i JOIN customers c ON c.id = i.customer_id
       WHERE i.revoked_at IS NULL AND (i.expires_at IS NULL OR i.expires_at > now())
         AND i.customer_id IN (${mine})
       ORDER BY i.created_at DESC`, [session.sub]),
  ]);
  return NextResponse.json({ requests, invites });
}
