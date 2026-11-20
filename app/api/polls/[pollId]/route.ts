import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { pollSociety, voterPayload } from '@/lib/polls/access';
import { auditLog, codeAttemptAllowed, codeAttemptFailed, codeVoter, findCode, hasVoted, loadPoll, myBallot, openQuestions, results, resultsVisible } from '@/lib/polls/server';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ pollId: string }> };
const ip = (req: NextRequest) => req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

// POST { code } — someone with an access code opens the poll.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { pollId } = await params;
  if (!codeAttemptAllowed(ip(req))) return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
  const cid = await pollSociety(pollId);
  const poll = cid != null ? await loadPoll(cid, pollId) : null;
  // Sealed polls are for members only: code holders have no key to read them
  if (poll?.sealed_payload) return NextResponse.json({ error: 'This poll is for members only' }, { status: 404 });
  const { code } = await req.json().catch(() => ({}));
  const c = poll && poll.allow_codes && typeof code === 'string' ? await findCode(poll.id, code) : null;
  if (!poll || !c) { codeAttemptFailed(ip(req)); return NextResponse.json({ error: 'That code is not valid for this poll' }, { status: 404 }); }
  if (c.revoked) return NextResponse.json({ error: 'This code has been withdrawn by the poll’s organisers. Please ask them for a new one.' }, { status: 403 });
  // A right code for a poll that isn't open yet: say so (only someone holding a valid code learns this)
  if (poll.status === 'draft') return NextResponse.json({ error: 'Your code is valid, but this poll hasn’t opened yet. Please try again once the organisers open it.' }, { status: 409 });
  const voted = await hasVoted(poll.id, codeVoter(c.id));
  const { rows: [s] } = await pool.query('SELECT name FROM customers WHERE id = $1', [cid]);
  const { payload: _p, ...settings } = poll;
  return NextResponse.json({
    society: s?.name ?? null,
    poll: { ...settings, payload: voterPayload(poll, false), open_questions: openQuestions(poll) },
    voted, myBallot: voted ? await myBallot(poll, codeVoter(c.id)) : null,
    canVote: poll.status === 'open' && (!voted || poll.allow_revote),
    results: resultsVisible(poll, false) ? await results(poll, false) : null,
    audit: voted ? await auditLog(poll) : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export const POST = lockSafe(handlePOST);
