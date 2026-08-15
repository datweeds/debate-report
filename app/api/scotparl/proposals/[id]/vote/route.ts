import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { pollId } = await req.json();
  if (!pollId?.trim()) return NextResponse.json({ error: 'pollId is required' }, { status: 400 });

  const { rows: [proposal] } = await pool.query(`SELECT id FROM proposals WHERE id = $1`, [id]);
  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

  await pool.query(
    `UPDATE proposals SET pvc_poll_id = $1 WHERE id = $2`,
    [pollId.trim(), id]
  );
  return NextResponse.json({ pollId: pollId.trim() });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await pool.query(`UPDATE proposals SET pvc_poll_id = NULL WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
