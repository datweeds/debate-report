import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { readPrinciple } from '@/lib/principles';

type Params = { params: Promise<{ libId: string }> };

// PATCH — SysAdmin edits a library principle. Societies that already copied it keep their own copy.
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { libId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(libId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const p = readPrinciple(await req.json().catch(() => ({})));
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  await pool.query(
    'UPDATE principle_library SET category = $1, title = $2, body = $3, grounding = $4, updated_at = now() WHERE id = $5',
    [p.category, p.title, p.body, p.grounding, libId],
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { libId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(libId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await pool.query('DELETE FROM principle_library WHERE id = $1', [libId]);
  return NextResponse.json({ ok: true });
}
