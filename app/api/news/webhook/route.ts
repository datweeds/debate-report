import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { type Digest, storeEdition, verifySignature } from '@/lib/news';

// POST — a new edition from the News service, signed with the Society's
// webhook secret (X-News-Signature).
export async function POST(req: NextRequest) {
  const body = await req.text();
  let digest: Digest;
  try {
    digest = JSON.parse(body).digest;
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const m = /^society:(\d+)$/.exec(digest?.external_ref ?? '');
  if (!m) return NextResponse.json({ error: 'Unknown subscription' }, { status: 404 });
  const societyId = Number(m[1]);
  const { rows: [row] } = await pool.query('SELECT webhook_secret FROM society_news WHERE customer_id = $1', [societyId]);
  if (!row?.webhook_secret) return NextResponse.json({ error: 'Unknown subscription' }, { status: 404 });
  if (!verifySignature(body, req.headers.get('x-news-signature'), row.webhook_secret)) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
  }
  await storeEdition(societyId, digest);
  return NextResponse.json({ ok: true });
}
