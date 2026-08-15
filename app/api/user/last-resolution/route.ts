import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { resolutionId } = await req.json() as { resolutionId: string };
  if (!resolutionId) return NextResponse.json({ error: 'Missing resolutionId' }, { status: 400 });

  await pool.query(
    `UPDATE users SET last_resolution_id = $2 WHERE id = $1`,
    [session.sub, resolutionId],
  );

  return NextResponse.json({ ok: true });
}
