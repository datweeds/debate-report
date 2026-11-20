import { NextRequest, NextResponse } from 'next/server';
import { pollContext } from '@/lib/polls/access';
import { auditLog } from '@/lib/polls/server';

type Params = { params: Promise<{ id: string; pollId: string }> };

// GET — the receipt hashes of every ballot: voters check theirs is counted; anyone can check the total.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, pollId } = await params;
  const c = await pollContext(req, id, pollId);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ title: c.poll.payload.title, status: c.poll.status, ...(await auditLog(c.poll)) });
}
