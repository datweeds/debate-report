import { NextRequest, NextResponse } from 'next/server';
import { openText } from '@/lib/societyCrypto';
import { shareByToken, shareState } from '@/lib/documentShares';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ token: string }> };
const noStore = { 'Cache-Control': 'private, no-store' };

// GET — what a share link points to (no account needed). A private link's
// document details are inside its encrypted copy, so only the Society and
// sharer are shown until the recipient's browser opens it.
async function handleGET(_req: NextRequest, { params }: Params) {
  const s = await shareByToken((await params).token);
  const state = s ? shareState(s) : null;
  if (!s || state === 'not-allowed') return NextResponse.json({ error: 'This link doesn’t exist or has been revoked' }, { status: 404, headers: noStore });
  if (state === 'expired') return NextResponse.json({ error: 'This link has expired. Ask the person who shared it for a new one.' }, { status: 410, headers: noStore });
  const common = { mode: s.mode, society: s.society_name, sharedBy: s.sharer, expiresAt: s.expires_at };
  if (s.mode === 'private') return NextResponse.json({ ...common, size: Number(s.size_bytes) }, { headers: noStore });
  return NextResponse.json({
    ...common,
    title: await openText(s.customer_id, s.title),
    fileName: await openText(s.customer_id, s.file_name),
    mimeType: s.mime_type, size: Number(s.doc_size),
  }, { headers: noStore });
}

export const GET = lockSafe(handleGET);
