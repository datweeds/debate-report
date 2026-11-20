import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { pushToUser } from '@/lib/push';

// POST — send yourself a test notification on every device you've switched on.
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const sent = await pushToUser(session.sub, {
    title: 'new.vote notifications are on', body: 'You’ll hear about new things in your Societies here.', url: '/profile#notifications', tag: 'test',
  });
  return NextResponse.json({ sent });
}
