import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { isSocietyModerator } from '@/lib/roles';
import { deleteSociety, protectedReason, sentenceMatches } from '@/lib/societyDelete';

type Params = { params: Promise<{ id: string }> };

// The Society's moderators (or a Sys Admin) only
async function guard(req: NextRequest, params: Params['params']) {
  const session = await getSessionFromRequest(req);
  const id = parseInt((await params).id, 10);
  if (!session || isNaN(id)) return null;
  if (!session.isSysAdmin && !await isSocietyModerator(session, id)) return null;
  return { session, id };
}

// POST { action: 'close' | 'reopen' }
export async function POST(req: NextRequest, { params }: Params) {
  const g = await guard(req, params);
  if (!g) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const action = (await req.json().catch(() => ({}))).action;
  if (action !== 'close' && action !== 'reopen') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  const blocked = await protectedReason(g.id);
  if (blocked) return NextResponse.json({ error: blocked }, { status: blocked === 'Not found' ? 404 : 400 });
  await pool.query('UPDATE customers SET status = $1, updated_at = now() WHERE id = $2', [action === 'close' ? 'closed' : 'active', g.id]);
  console.log(`[society] ${g.id} ${action === 'close' ? 'closed' : 'reopened'} by ${g.session.sub}`);
  return NextResponse.json({ ok: true, status: action === 'close' ? 'closed' : 'active' });
}

// DELETE { confirmed: true, sentence } — both confirmations, then everything is erased
export async function DELETE(req: NextRequest, { params }: Params) {
  const g = await guard(req, params);
  if (!g) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  if (b.confirmed !== true || !sentenceMatches(b.sentence)) {
    return NextResponse.json({ error: 'Type the confirmation sentence exactly to delete the Society' }, { status: 400 });
  }
  const blocked = await protectedReason(g.id);
  if (blocked) return NextResponse.json({ error: blocked }, { status: blocked === 'Not found' ? 404 : 400 });
  try {
    const r = await deleteSociety(g.id, g.session.sub);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error('[society delete]', e);
    return NextResponse.json({ error: 'The Society couldn’t be deleted. Nothing was removed; please try again or contact support.' }, { status: 500 });
  }
}
