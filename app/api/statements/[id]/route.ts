import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const { rows: [stmt] } = await pool.query(
    'SELECT id, created_by FROM statements WHERE id = $1',
    [id],
  );
  if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (stmt.created_by !== session.sub && !session.isSysAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const title = (body.title ?? '').toString().trim();
  const description = body.description != null ? body.description.toString().trim() : null;

  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  await pool.query(
    'UPDATE statements SET stat_title = $2, stat_description = $3 WHERE id = $1',
    [id, title, description || null],
  );

  return NextResponse.json({ ok: true });
}
