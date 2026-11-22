import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { clearCookie, forgetSessionsOf, getSessionFromRequest } from '@/lib/auth';
import { accountBlockers, accountSentenceMatches, deleteAccount } from '@/lib/accountDelete';
import { hasPlan } from '@/lib/billing';

export const dynamic = 'force-dynamic';

// GET: what the Your data page needs — Societies you can export, and anything
// stopping the account being deleted
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const [{ rows: [me] }, { rows: societies }, blockers] = await Promise.all([
    pool.query(`SELECT user_handle AS handle FROM users WHERE id = $1`, [session.sub]),
    pool.query(
      `SELECT c.id, c.name, c.status FROM customers c JOIN customer_roles r ON r.tenant_id = c.id AND r.user_id = $1 AND r.role = 'customer_admin'
       ORDER BY c.name`, [session.sub]),
    accountBlockers(session.sub),
  ]);
  const paid = await hasPlan({ kind: 'user', id: session.sub });
  return NextResponse.json({
    handle: me?.handle, paid, societies, blockers,
  });
}

// DELETE { confirmed: true, sentence }: delete the signed-in account
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (b.confirmed !== true || !accountSentenceMatches(b.sentence)) {
    return NextResponse.json({ error: 'Type the confirmation sentence exactly to delete your account' }, { status: 400 });
  }
  const blockers = await accountBlockers(session.sub);
  if (blockers.length) return NextResponse.json({ error: blockers[0].message, blockers }, { status: 409 });
  try {
    await deleteAccount(session.sub);
  } catch (e) {
    console.error('[account] delete', session.sub, e);
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg.startsWith('Couldn’t') ? msg : 'Couldn’t delete your account. Please try again.' }, { status: 500 });
  }
  forgetSessionsOf(session.sub);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearCookie());
  return res;
}
