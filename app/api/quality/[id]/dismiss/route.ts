import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { canReviewQuality, getDebate } from '@/lib/quality/report';

type Params = { params: Promise<{ id: string }> };

async function authorise(req: NextRequest, id: string) {
  const session = await getSessionFromRequest(req);
  const debate = await getDebate(id);
  return session && debate && await canReviewQuality(session, debate) ? session : null;
}

// POST { fingerprint, note?, observation? } — dismiss a finding for this debate (persists across runs).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await authorise(req, id);
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { fingerprint, note, observation } = await req.json().catch(() => ({}));
  if (typeof fingerprint !== 'string' || !fingerprint) {
    return NextResponse.json({ error: 'fingerprint is required' }, { status: 400 });
  }
  await pool.query(
    `INSERT INTO quality_dismissals (resolution_id, fingerprint, dismissed_by, note, observation)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (resolution_id, fingerprint)
     DO UPDATE SET note = EXCLUDED.note, dismissed_by = EXCLUDED.dismissed_by, dismissed_at = now()`,
    [id, fingerprint, session.sub,
     typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null,
     typeof observation === 'string' ? observation.slice(0, 1000) : null],
  );
  return NextResponse.json({ ok: true });
}

// DELETE ?fingerprint=… — restore a dismissed finding.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!await authorise(req, id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const fingerprint = req.nextUrl.searchParams.get('fingerprint');
  if (!fingerprint) return NextResponse.json({ error: 'fingerprint is required' }, { status: 400 });
  await pool.query('DELETE FROM quality_dismissals WHERE resolution_id = $1 AND fingerprint = $2', [id, fingerprint]);
  return NextResponse.json({ ok: true });
}
