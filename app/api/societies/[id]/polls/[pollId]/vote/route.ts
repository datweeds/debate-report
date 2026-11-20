import { NextRequest, NextResponse } from 'next/server';
import { castBallot } from '@/lib/polls/server';
import { pollContext } from '@/lib/polls/access';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pollId: string }> };

// POST { answers, receiptHash } — a member votes (or updates their vote while it's open).
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.voterKey) return NextResponse.json({ error: 'Join this Society to vote' }, { status: 403 });
  if (!c.poll.members_may_vote) return NextResponse.json({ error: 'This poll is for access-code holders' }, { status: 403 });
  const { answers, receiptHash } = await req.json().catch(() => ({}));
  const r = await castBallot(c.poll, { key: c.voterKey, userId: c.a.session!.sub }, answers, receiptHash);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, revoted: r.revoted }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
