import { NextRequest, NextResponse } from 'next/server';
import { pollContext } from '@/lib/polls/access';
import { verifyPoll } from '@/lib/polls/server';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pollId: string }> };

// GET — moderators: check the count (voters, ballots, receipts, decryption, an independent recount).
async function handleGET(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.manager && !c.scrutineer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json(await verifyPoll(c.poll));
}

export const GET = lockSafe(handleGET);
