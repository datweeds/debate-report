import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { isSocietyModerator } from '@/lib/roles';
import { exportSociety } from '@/lib/dataExport';
import { sendExport } from '@/lib/exportResponse';

export const dynamic = 'force-dynamic';

// GET: a ZIP of everything in the Society. Its Society Admins (or a Sys Admin) only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(req);
  const id = parseInt((await params).id, 10);
  if (!session || isNaN(id) || (!session.isSysAdmin && !await isSocietyModerator(session, id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const res = await sendExport(`society:${id}`, () => exportSociety(id));
    console.log(`[export] Society ${id} exported by ${session.sub}`);
    return res;
  } catch (e) {
    if ((e as Error).message === 'Not found') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    console.error('[export] society', id, e);
    return NextResponse.json({ error: 'Couldn’t prepare the export. Please try again.' }, { status: 500 });
  }
}
