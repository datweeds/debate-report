import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const { rows: [debate] } = await pool.query(
    `SELECT id, created_by, customer_id, stat_status, vote_total_for, vote_total_against
     FROM statements WHERE id = $1 AND stat_type = 'resolution'`,
    [id]
  );
  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { isSocietyModerator } = await import('@/lib/roles');
  if (!await isSocietyModerator(session, debate.customer_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (debate.stat_status === 'closed') {
    return NextResponse.json({ error: 'Already closed' }, { status: 409 });
  }
  if (debate.stat_status === 'deleted') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { decision, rationale, hidden } = await req.json();

  if (!['for', 'against', 'draw'].includes(decision)) {
    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 });
  }
  if (!rationale?.trim()) {
    return NextResponse.json({ error: 'Rationale is required' }, { status: 400 });
  }

  await pool.query(
    `UPDATE statements
     SET stat_status         = 'closed',
         resolution_decision = $1,
         closing_statement   = $2,
         stat_hidden         = $3,
         updated_at          = NOW()
     WHERE id = $4`,
    [decision, rationale.trim(), Boolean(hidden), id]
  );

  return NextResponse.json({
    ok: true,
    voteFor:     debate.vote_total_for,
    voteAgainst: debate.vote_total_against,
  });
}
