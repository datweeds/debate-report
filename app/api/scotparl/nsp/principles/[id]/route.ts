import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const { title, body, grounding } = await req.json();

  await pool.query(
    `UPDATE nsp_principles SET title = $1, body = $2, grounding = $3 WHERE id = $4`,
    [title?.trim(), body?.trim(), grounding?.trim() ?? '', id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  await pool.query(`DELETE FROM nsp_principles WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
