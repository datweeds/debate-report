import { NextRequest, NextResponse } from 'next/server';
import { tq } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);
type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { canManageDebates } = await import('@/lib/roles');
  if (!await canManageDebates(session, TENANT_ID)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { pollId } = await req.json();
  if (!pollId?.trim()) return NextResponse.json({ error: 'pollId is required' }, { status: 400 });

  const { rows: [proposal] } = await tq(`SELECT id FROM proposals WHERE id = $1`, [id]);
  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

  await tq(`UPDATE proposals SET pvc_poll_id = $1 WHERE id = $2`, [pollId.trim(), id]);
  return NextResponse.json({ pollId: pollId.trim() });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const { canManageDebates } = await import('@/lib/roles');
  if (!await canManageDebates(session, TENANT_ID)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await tq(`UPDATE proposals SET pvc_poll_id = NULL WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
