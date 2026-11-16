import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { currentPrinciple } from '@/lib/principles';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pid: string }> };

// POST { text } — a member asks for a principle to be reviewed.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const a = await societyContentAccess(req, id);
  const p = a ? await currentPrinciple(a.societyId, pid) : null;
  if (!a || !p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canPost) return NextResponse.json({ error: 'Join this Society to request a review' }, { status: 403 });
  const { text } = await req.json().catch(() => ({}));
  if (typeof text !== 'string' || !text.trim()) return NextResponse.json({ error: 'Say what should be reviewed and why' }, { status: 400 });
  await pool.query(
    `INSERT INTO society_principle_reviews (customer_id, lineage_id, user_id, request_text) VALUES ($1, $2, $3, $4)`,
    [a.societyId, p.lineage_id, a.session!.sub, await sealText(a.societyId, text.trim().slice(0, 2000))],
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}

// PATCH { reviewId, status: 'under_review' | 'resolved' } — moderators.
async function handlePATCH(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const a = await societyContentAccess(req, id);
  const p = a ? await currentPrinciple(a.societyId, pid) : null;
  if (!a || !p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { reviewId, status } = await req.json().catch(() => ({}));
  if (!['under_review', 'resolved'].includes(status) || typeof reviewId !== 'string' || !/^[0-9a-f-]{36}$/i.test(reviewId)) {
    return NextResponse.json({ error: 'reviewId and status are required' }, { status: 400 });
  }
  await pool.query(
    'UPDATE society_principle_reviews SET status = $1 WHERE id = $2 AND lineage_id = $3',
    [status, reviewId, p.lineage_id],
  );
  return NextResponse.json({ ok: true });
}

export const POST = lockSafe(handlePOST);
export const PATCH = lockSafe(handlePATCH);
