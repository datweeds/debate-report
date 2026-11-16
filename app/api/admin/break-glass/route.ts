import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { endGrant, GRANT_MINUTES, openGrant } from '@/lib/breakGlass';

// GET — private Societies, any active emergency access, and the recent log. SysAdmin.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const [{ rows: societies }, { rows: log }] = await Promise.all([
    pool.query(
      `SELECT c.id, c.name, c.visibility,
              (SELECT max(g.expires_at) FROM sysadmin_access g WHERE g.customer_id = c.id AND g.user_id = $1
                 AND g.ended_at IS NULL AND g.expires_at > now()) AS my_grant_until
       FROM customers c WHERE c.visibility <> 'public' ORDER BY c.name`, [session.sub]),
    pool.query(
      `SELECT g.id, c.name AS society, u.user_handle AS sysadmin, g.reason, g.created_at, g.expires_at, g.ended_at
       FROM sysadmin_access g JOIN customers c ON c.id = g.customer_id LEFT JOIN users u ON u.id = g.user_id
       ORDER BY g.created_at DESC LIMIT 50`),
  ]);
  return NextResponse.json({ societies, log, minutes: GRANT_MINUTES });
}

// POST { societyId, reason } — open emergency access to a private Society. SysAdmin.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { societyId, reason } = await req.json().catch(() => ({}));
  const id = Number(societyId);
  const why = typeof reason === 'string' ? reason.trim() : '';
  if (why.length < 15) return NextResponse.json({ error: 'Give a reason of at least 15 characters; it is shown to the Society' }, { status: 400 });
  const { rows: [c] } = await pool.query('SELECT visibility FROM customers WHERE id = $1', [id]);
  if (!c) return NextResponse.json({ error: 'Society not found' }, { status: 404 });
  if (c.visibility === 'public') return NextResponse.json({ error: 'Public Societies need no emergency access' }, { status: 400 });
  const g = await openGrant(session, id, why.slice(0, 1000));
  return NextResponse.json({ ok: true, expires_at: g.expires_at });
}

// DELETE { societyId } — end your emergency access now. SysAdmin.
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { societyId } = await req.json().catch(() => ({}));
  await endGrant(session, Number(societyId));
  return NextResponse.json({ ok: true });
}
