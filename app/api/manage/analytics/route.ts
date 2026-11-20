import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { buildAnalytics } from '@/lib/analytics';

// GET ?society=<id> — analytics for the Societies this user administers
// (their Society Admin role, not mere membership); one of them, or all.
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { rows: societies } = await pool.query(
    `SELECT c.id, c.name FROM customer_roles r JOIN customers c ON c.id = r.tenant_id
     WHERE r.user_id = $1 AND r.role = 'customer_admin' ORDER BY c.name`, [session.sub]);
  if (!societies.length) return NextResponse.json({ societies: [] });
  const want = Number(req.nextUrl.searchParams.get('society'));
  const scope = want && societies.some(s => s.id === want) ? [want] : societies.map(s => s.id as number);
  try {
    const data = await buildAnalytics({ scope, me: session.sub, sysAdmin: false });
    return NextResponse.json({ societies, ...data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[manage analytics]', err);
    return NextResponse.json({ error: 'Couldn’t load the analytics' }, { status: 500 });
  }
}
