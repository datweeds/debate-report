import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { isPrivateSociety } from '@/lib/societyCrypto';
import { forgetAllDebates } from '@/lib/debateCrypto';
import { requireKey } from '@/lib/masterKey';
import { lockSafe } from '@/lib/lockSafe';
import { allowsSealed, firstLocks, readLocks, sealedSection, UUID_RE_SEALED } from '@/lib/sealed/server';
import { debateTexts, sameTexts, storeTexts } from '@/lib/sealed/debates';

type Params = { params: Promise<{ id: string }> };

async function moderatorAccess(req: NextRequest, id: string) {
  const a = await societyContentAccess(req, id);
  if (!a?.session) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!a.canModerate || !a.isMember) return { error: NextResponse.json({ error: 'Only the Society’s admins can do this' }, { status: 403 }) };
  return { a };
}

// GET — whether the Society's debates are sealed, whether they can be, and
// (for moderators) every piece of text in them: decrypted from the server's
// encryption when not sealed (to seal), as stored when sealed (to unseal).
async function handleGET(req: NextRequest, { params }: Params) {
  const { a, error } = await moderatorAccess(req, (await params).id);
  if (error) return error;
  const sealed = await sealedSection(a.societyId, 'debates');
  const isPrivate = await isPrivateSociety(a.societyId);
  const canSeal = isPrivate && await allowsSealed(a.societyId);
  if (req.nextUrl.searchParams.get('texts') !== '1') {
    return NextResponse.json({ sealed: sealed && { id: sealed.id, epoch: sealed.epoch }, canSeal, isPrivate });
  }
  if (!sealed) requireKey();
  return NextResponse.json({ sealed: sealed && { id: sealed.id, epoch: sealed.epoch }, texts: await debateTexts(a.societyId, !sealed) });
}

// POST — a moderator seals or unseals all the Society's debates. The browser
// does the encrypting (or decrypting) and sends every piece of text back.
//   { action: 'seal', itemId, locks, texts: [{ k, id, v }] }   (sealed, epoch 1)
//   { action: 'unseal', texts: [{ k, id, v }] }                (plain text)
async function handlePOST(req: NextRequest, { params }: Params) {
  const { a, error } = await moderatorAccess(req, (await params).id);
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const sealed = await sealedSection(a.societyId, 'debates');
  requireKey();
  const client = await pool.connect();
  const fail = async (status: number, err: string) => { await client.query('ROLLBACK'); return NextResponse.json({ error: err }, { status }); };
  try {
    await client.query('BEGIN');
    // Everything must be included, so nothing is left behind
    const now = await debateTexts(a.societyId, false, client);
    if (!sameTexts(now, b.texts)) return fail(409, 'The debates changed while this was happening: try again');
    if (b.action === 'seal') {
      if (sealed) return fail(409, 'The debates are already sealed');
      if (!await isPrivateSociety(a.societyId)) return fail(403, 'Only a private Society’s debates can be sealed');
      if (!await allowsSealed(a.societyId)) return fail(403, 'This Society doesn’t allow Sealed items');
      const locks = readLocks(b.locks);
      if (typeof b.itemId !== 'string' || !UUID_RE_SEALED.test(b.itemId) || !locks) return fail(400, 'That wasn’t understood');
      const item = { type: 'debates' as const, id: b.itemId, societyId: a.societyId, epoch: 1 };
      await client.query(`INSERT INTO society_sealed_sections (customer_id, section, item_id, sealed_by) VALUES ($1, 'debates', $2, $3)`,
        [a.societyId, item.id, a.session!.sub]);
      const problem = await firstLocks(client, item, a.session!.sub, locks) ?? await storeTexts(client, a.societyId, b.texts, true);
      if (problem) return fail(400, problem);
    } else if (b.action === 'unseal') {
      if (!sealed) return fail(409, 'The debates aren’t sealed');
      const problem = await storeTexts(client, a.societyId, b.texts, false);
      if (problem) return fail(400, problem);
      await client.query('DELETE FROM sealed_item_keys WHERE item_type = $1 AND item_id = $2', ['debates', sealed.id]);
      await client.query(`DELETE FROM society_sealed_sections WHERE customer_id = $1 AND section = 'debates'`, [a.societyId]);
    } else return fail(400, 'Unknown action');
    await client.query('COMMIT');
    forgetAllDebates();
    return NextResponse.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

export const GET = lockSafe(handleGET);
export const POST = lockSafe(handlePOST);
