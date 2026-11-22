import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { readPrinciple } from '@/lib/principles';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import { allowsSealed, firstLocks, readLocks, sealedSection, UUID_RE_SEALED } from '@/lib/sealed/server';

type Params = { params: Promise<{ id: string }> };
type P = { id: string; title?: unknown; body?: unknown; grounding?: unknown; section?: unknown };

// POST — a moderator seals or unseals all the Society's principles, every
// version: the browser does the encrypting (or decrypting) and sends it all back.
//   { action: 'seal', itemId, locks, principles: [{ id, title, body, grounding, section }],
//     versions: [{ id, changeNote }], reviews: [{ id, text }] }      (sealed, epoch 1)
//   { action: 'unseal', principles, versions, reviews }               (plain text)
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a?.session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate || !a.isMember) return NextResponse.json({ error: 'Only the Society’s admins can do this' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const ps: P[] = Array.isArray(b.principles) ? b.principles : [];
  const vs: { id: string; changeNote?: unknown }[] = Array.isArray(b.versions) ? b.versions : [];
  const rs: { id: string; text?: unknown }[] = Array.isArray(b.reviews) ? b.reviews : [];

  // Everything must be included, so nothing is left behind
  const [{ rows: curP }, { rows: curV }, { rows: curR }] = await Promise.all([
    pool.query('SELECT p.id FROM society_principles p JOIN society_principle_versions v ON v.id = p.version_id WHERE v.customer_id = $1', [a.societyId]),
    pool.query('SELECT id FROM society_principle_versions WHERE customer_id = $1', [a.societyId]),
    pool.query('SELECT id FROM society_principle_reviews WHERE customer_id = $1', [a.societyId]),
  ]);
  const same = (cur: { id: string }[], given: { id: string }[]) => cur.length === given.length && cur.every(r => given.some(g => g.id === r.id));
  if (!same(curP, ps) || !same(curV, vs) || !same(curR, rs)) {
    return NextResponse.json({ error: 'The principles changed while this was happening: try again' }, { status: 409 });
  }
  const sealed = await sealedSection(a.societyId, 'principles');
  const client = await pool.connect();
  const fail = async (status: number, error: string) => { await client.query('ROLLBACK'); return NextResponse.json({ error }, { status }); };
  try {
    await client.query('BEGIN');
    if (b.action === 'seal') {
      if (sealed) return fail(409, 'The principles are already sealed');
      if (!await allowsSealed(a.societyId)) return fail(403, 'This Society doesn’t allow Sealed items');
      const locks = readLocks(b.locks);
      if (typeof b.itemId !== 'string' || !UUID_RE_SEALED.test(b.itemId) || !locks) return fail(400, 'That wasn’t understood');
      const isE2E = (v: unknown) => typeof v === 'string' && v.length <= 30000 && /^sn1:1:[A-Za-z0-9+/]+={0,2}$/.test(v);
      const opt = (v: unknown) => v == null || v === '' || isE2E(v);
      if (!ps.every(p => readPrinciple(p as Record<string, unknown>, isE2E).ok) || !vs.every(v => opt(v.changeNote)) || !rs.every(r => isE2E(r.text))) {
        return fail(400, 'Everything must be sealed');
      }
      const item = { type: 'principles' as const, id: b.itemId, societyId: a.societyId, epoch: 1 };
      await client.query(`INSERT INTO society_sealed_sections (customer_id, section, item_id, sealed_by) VALUES ($1, 'principles', $2, $3)`,
        [a.societyId, item.id, a.session.sub]);
      const problem = await firstLocks(client, item, a.session.sub, locks);
      if (problem) return fail(400, problem);
      for (const p of ps) await client.query('UPDATE society_principles SET title = $1, body = $2, grounding = $3, section = $4 WHERE id = $5',
        [p.title, p.body, p.grounding || null, p.section || null, p.id]);
      for (const v of vs) await client.query('UPDATE society_principle_versions SET change_note = $1 WHERE id = $2', [v.changeNote || null, v.id]);
      for (const r of rs) await client.query('UPDATE society_principle_reviews SET request_text = $1 WHERE id = $2', [r.text, r.id]);
    } else if (b.action === 'unseal') {
      if (!sealed) return fail(409, 'The principles aren’t sealed');
      const seal = (t: string | null) => sealText(a.societyId, t);   // the Society's usual rule
      for (const p of ps) {
        const v = readPrinciple(p as Record<string, unknown>);
        if (!v.ok) return fail(400, `A principle couldn’t be unsealed: ${v.error}`);
        await client.query('UPDATE society_principles SET title = $1, body = $2, grounding = $3, section = $4 WHERE id = $5',
          [await seal(v.title), await seal(v.body), await seal(v.grounding), await seal(v.section), p.id]);
      }
      for (const v of vs) {
        if (typeof v.changeNote === 'string' && v.changeNote.startsWith('sn1:')) return fail(400, 'A change note couldn’t be unsealed');
        await client.query('UPDATE society_principle_versions SET change_note = $1 WHERE id = $2',
          [await seal(typeof v.changeNote === 'string' ? v.changeNote.slice(0, 2000) : null), v.id]);
      }
      for (const r of rs) {
        if (typeof r.text !== 'string' || r.text.startsWith('sn1:')) return fail(400, 'A review request couldn’t be unsealed');
        await client.query('UPDATE society_principle_reviews SET request_text = $1 WHERE id = $2', [await seal(r.text.slice(0, 2000)), r.id]);
      }
      await client.query('DELETE FROM sealed_item_keys WHERE item_type = $1 AND item_id = $2', ['principles', sealed.id]);
      await client.query(`DELETE FROM society_sealed_sections WHERE customer_id = $1 AND section = 'principles'`, [a.societyId]);
    } else return fail(400, 'Unknown action');
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

export const POST = lockSafe(handlePOST);
