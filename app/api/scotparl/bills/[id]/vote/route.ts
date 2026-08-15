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

  const { rows: [bill] } = await pool.query(`SELECT id FROM sp_bills WHERE id = $1`, [id]);
  if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });

  await pool.query(
    `INSERT INTO sp_bill_pvc_polls (sp_bill_id, pvc_poll_id)
     VALUES ($1, $2)
     ON CONFLICT (sp_bill_id) DO UPDATE SET pvc_poll_id = EXCLUDED.pvc_poll_id`,
    [id, pollId.trim()]
  );
  return NextResponse.json({ pollId: pollId.trim() });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await pool.query(`DELETE FROM sp_bill_pvc_polls WHERE sp_bill_id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
