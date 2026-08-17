import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const proposalId = parseInt(id, 10);
  const { rows: existing } = await pool.query(
    `SELECT 1 FROM proposal_favs WHERE proposal_id = $1 AND user_id = $2`,
    [proposalId, session.sub],
  );

  if (existing.length > 0) {
    await pool.query(
      `DELETE FROM proposal_favs WHERE proposal_id = $1 AND user_id = $2`,
      [proposalId, session.sub],
    );
    return NextResponse.json({ isFavourite: false });
  } else {
    await pool.query(
      `INSERT INTO proposal_favs (proposal_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [proposalId, session.sub],
    );
    return NextResponse.json({ isFavourite: true });
  }
}
