import { clientIp } from '@/lib/clientIp';
import { NextRequest, NextResponse } from 'next/server';
import { pollSociety } from '@/lib/polls/access';
import { castBallot, codeAttemptAllowed, codeAttemptFailed, codeVoter, findCode, loadPoll } from '@/lib/polls/server';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ pollId: string }> };
const ip = (req: NextRequest) => clientIp(req.headers);

// POST { code, answers, receiptHash } — vote with an access code.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { pollId } = await params;
  if (!codeAttemptAllowed(ip(req))) return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
  const cid = await pollSociety(pollId);
  const poll = cid != null ? await loadPoll(cid, pollId) : null;
  // Sealed polls are for members only: code holders have no key to read them
  if (poll?.sealed_payload) return NextResponse.json({ error: 'This poll is for members only' }, { status: 404 });
  const { code, answers, receiptHash } = await req.json().catch(() => ({}));
  const c = poll && poll.allow_codes && typeof code === 'string' ? await findCode(poll.id, code) : null;
  if (!poll || !c) { codeAttemptFailed(ip(req)); return NextResponse.json({ error: 'That code is not valid for this poll' }, { status: 404 }); }
  if (c.revoked) return NextResponse.json({ error: 'This code has been withdrawn by the poll’s organisers. Please ask them for a new one.' }, { status: 403 });
  const r = await castBallot(poll, { key: codeVoter(c.id), codeId: c.id }, answers, receiptHash);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, revoted: r.revoted }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
