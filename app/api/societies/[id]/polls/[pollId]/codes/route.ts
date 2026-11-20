import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { pollContext } from '@/lib/polls/access';
import { hashCode, newCode } from '@/lib/polls/server';
import { openRows, sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pollId: string }> };

// GET — moderators: the poll's access codes (never the codes themselves: only a hash is kept).
export async function GET(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (c.poll.sealed_payload) return NextResponse.json({ error: 'Sealed polls are for members only: access codes can’t be used' }, { status: 409 });
  if (!c.manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { rows } = await pool.query(
    'SELECT id, label, created_at, used_at, revoked_at FROM poll_codes WHERE poll_id = $1 ORDER BY created_at', [c.poll.id]);
  await openRows(c.a.societyId, rows, ['label']);
  return NextResponse.json({ codes: rows });
}

// POST { labels: string[] } or { count } — moderators make codes. Each code is shown once, here.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (c.poll.sealed_payload) return NextResponse.json({ error: 'Sealed polls are for members only: access codes can’t be used' }, { status: 409 });
  if (!c.manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!c.poll.allow_codes) return NextResponse.json({ error: 'Turn on access codes for this poll first' }, { status: 400 });
  if (c.poll.status === 'closed') return NextResponse.json({ error: 'This poll is closed' }, { status: 409 });
  const b = await req.json().catch(() => ({}));
  const labels: (string | null)[] = Array.isArray(b.labels) && b.labels.length
    ? b.labels.map((l: unknown) => (typeof l === 'string' && l.trim() ? l.trim().slice(0, 120) : null))
    : Array.from({ length: Math.min(Math.max(Number(b.count) || 0, 0), 500) }, () => null);
  if (!labels.length || labels.length > 500) return NextResponse.json({ error: 'Make between 1 and 500 codes' }, { status: 400 });
  const out: { code: string; label: string | null }[] = [];
  for (const label of labels) {
    const code = newCode();
    await pool.query('INSERT INTO poll_codes (poll_id, code_hash, label) VALUES ($1, $2, $3)',
      [c.poll.id, hashCode(code), await sealText(c.a.societyId, label, true)]);
    out.push({ code, label });
  }
  return NextResponse.json({ codes: out }, { status: 201 });
}

// DELETE { codeId } — revoke an unused code.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (c.poll.sealed_payload) return NextResponse.json({ error: 'Sealed polls are for members only: access codes can’t be used' }, { status: 409 });
  if (!c.manager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { codeId } = await req.json().catch(() => ({}));
  const { rowCount } = await pool.query(
    'UPDATE poll_codes SET revoked_at = now() WHERE id = $1 AND poll_id = $2 AND used_at IS NULL AND revoked_at IS NULL', [codeId, c.poll.id]);
  if (!rowCount) return NextResponse.json({ error: 'Only an unused code can be revoked' }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export const POST = lockSafe(handlePOST);
