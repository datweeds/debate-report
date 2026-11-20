import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { exportUser } from '@/lib/dataExport';
import { sendExport } from '@/lib/exportResponse';

export const dynamic = 'force-dynamic';

// GET: a ZIP of everything the signed-in member has put into the site
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  try {
    const res = await sendExport(`user:${session.sub}`, () => exportUser(session.sub));
    console.log(`[export] personal data exported by ${session.sub}`);
    return res;
  } catch (e) {
    console.error('[export] personal', e);
    return NextResponse.json({ error: 'Couldn’t prepare your data. Please try again.' }, { status: 500 });
  }
}
