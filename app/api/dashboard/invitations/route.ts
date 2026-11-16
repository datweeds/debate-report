import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { openDeep } from '@/lib/societyCrypto';

// `sent`: invitations the viewer can administer (their Societies, or all if
// SysAdmin) — replaces "magic links across every forum I own."
// `received`: invitations addressed to the viewer themselves, to accept or
// decline from their own Invitations list (no email/token link needed —
// invitees are always existing, logged-in Society members).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const [{ rows: sent }, { rows: received }] = await Promise.all([
    pool.query(
      `SELECT di.id, di.resolution_id, s.stat_title AS debate_title,
              di.invitee_user_id, u.user_handle, u.user_full_name,
              di.status, di.message, di.created_at,
              c.name AS society_name
       FROM debate_invitations di
       JOIN statements s ON s.id = di.resolution_id
       LEFT JOIN users u ON u.id::text = di.invitee_user_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.customer_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM customer_roles cr
               WHERE cr.user_id = $1 AND cr.tenant_id = s.customer_id AND cr.role = 'customer_admin'
             )
       ORDER BY di.created_at DESC`,
      [session.sub]
    ),
    pool.query(
      `SELECT di.id, di.resolution_id, s.stat_title AS debate_title,
              di.status, di.message, di.created_at,
              iu.user_handle AS inviter_handle
       FROM debate_invitations di
       JOIN statements s ON s.id = di.resolution_id
       LEFT JOIN users iu ON iu.id = di.created_by
       WHERE di.invitee_user_id = $1
       ORDER BY di.created_at DESC`,
      [session.sub]
    ),
  ]);

  await openDeep([sent, received]);
  return NextResponse.json({ sent, received });
}
