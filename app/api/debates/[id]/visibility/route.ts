import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canSetDebateVisibility } from '@/lib/roles';

type Params = { params: Promise<{ id: string }> };

const VALID = new Set(['public', 'apply', 'invite']);

// Only a debate's Society Admin or SysAdmin may set its visibility — not
// topic-owners, not the debate's creator (narrower than canManageDebates).
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;
  const { visibility } = await req.json();
  if (!VALID.has(visibility)) {
    return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 });
  }

  const { rows: [debate] } = await pool.query(
    `SELECT s.customer_id, c.is_public AS society_is_public
     FROM statements s
     LEFT JOIN customers c ON c.id = s.customer_id
     WHERE s.id = $1 AND s.stat_type = 'resolution'`,
    [id]
  );
  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (debate.customer_id == null || !(await canSetDebateVisibility(session, debate.customer_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // A debate in a private Society can never be made Public.
  if (visibility === 'public' && !debate.society_is_public) {
    return NextResponse.json({ error: 'Debates in a private Society cannot be set to Public' }, { status: 400 });
  }

  await pool.query(`UPDATE statements SET debate_visibility = $1 WHERE id = $2`, [visibility, id]);
  return NextResponse.json({ ok: true });
}
