import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { activate } from '@/lib/holds';

// POST { action: 'activate', instead? } — the owner makes a read-only Society
// active: straight away if their plan has room, or in place of another of
// their Societies (`instead`), which becomes read-only.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  const id = Number((await params).id);
  if (!session || !Number.isInteger(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (b.action !== 'activate') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  const r = await activate(id, session.sub, Number.isInteger(Number(b.instead)) && b.instead ? Number(b.instead) : undefined);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
