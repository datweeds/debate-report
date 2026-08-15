import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const billId = parseInt(id, 10);
  const { rows: existing } = await pool.query(
    `SELECT 1 FROM sp_bill_favs WHERE bill_id = $1 AND user_id = $2`,
    [billId, session.sub],
  );

  if (existing.length > 0) {
    await pool.query(
      `DELETE FROM sp_bill_favs WHERE bill_id = $1 AND user_id = $2`,
      [billId, session.sub],
    );
    return NextResponse.json({ isFavourite: false });
  } else {
    await pool.query(
      `INSERT INTO sp_bill_favs (bill_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [billId, session.sub],
    );
    return NextResponse.json({ isFavourite: true });
  }
}
