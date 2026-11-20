import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { readEvent } from '@/lib/events';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';
import { allowsSealed, firstLocks, readLocks, sealedSection, UUID_RE_SEALED } from '@/lib/sealed/server';

type Params = { params: Promise<{ id: string }> };
type Row = { id: string; title?: unknown; description?: unknown; location?: unknown };

// POST — a moderator seals or unseals the whole calendar. The browser does the
// encrypting (or decrypting) and sends every event's text back:
//   { action: 'seal', itemId, locks: [{ userId, lockedKey }], events: [{ id, title, description, location }] }
//     (sealed for epoch 1 of the new item)
//   { action: 'unseal', events: [{ id, title, description, location }] }   (plain text)
// Every current event must be included, so nothing is left behind.
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a?.session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate || !a.isMember) return NextResponse.json({ error: 'Only the Society’s moderators can do this' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const rows: Row[] = Array.isArray(b.events) ? b.events : [];
  const sealed = await sealedSection(a.societyId, 'calendar');

  const { rows: current } = await pool.query('SELECT id FROM society_events WHERE customer_id = $1 AND deleted_at IS NULL', [a.societyId]);
  const given = new Set(rows.map(r => r.id));
  if (current.length !== rows.length || current.some(r => !given.has(r.id))) {
    return NextResponse.json({ error: 'The calendar changed while this was happening: try again' }, { status: 409 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (b.action === 'seal') {
      if (sealed) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'The calendar is already sealed' }, { status: 409 }); }
      if (!await allowsSealed(a.societyId)) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'This Society doesn’t allow Sealed items' }, { status: 403 }); }
      const locks = readLocks(b.locks);
      if (typeof b.itemId !== 'string' || !UUID_RE_SEALED.test(b.itemId) || !locks) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'That wasn’t understood' }, { status: 400 }); }
      const item = { type: 'calendar' as const, id: b.itemId, societyId: a.societyId, epoch: 1 };
      const isE2E = (v: unknown) => typeof v === 'string' && v.length <= 30000 && /^sn1:1:[A-Za-z0-9+/]+={0,2}$/.test(v);
      for (const r of rows) {
        const e = readEvent({ title: r.title, description: r.description, location: r.location, startsAt: new Date().toISOString() }, isE2E);
        if (!e.ok) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Every event must be sealed' }, { status: 400 }); }
      }
      await client.query(`INSERT INTO society_sealed_sections (customer_id, section, item_id, sealed_by) VALUES ($1, 'calendar', $2, $3)`,
        [a.societyId, item.id, a.session.sub]);
      const problem = await firstLocks(client, item, a.session.sub, locks);
      if (problem) { await client.query('ROLLBACK'); return NextResponse.json({ error: problem }, { status: 400 }); }
      for (const r of rows) {
        await client.query('UPDATE society_events SET title = $1, description = $2, location = $3, updated_at = now() WHERE id = $4',
          [r.title, r.description || null, r.location || null, r.id]);
      }
    } else if (b.action === 'unseal') {
      if (!sealed) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'The calendar isn’t sealed' }, { status: 409 }); }
      for (const r of rows) {
        const e = readEvent({ title: r.title, description: r.description, location: r.location, startsAt: new Date().toISOString() });
        if (!e.ok) { await client.query('ROLLBACK'); return NextResponse.json({ error: `An event couldn’t be unsealed: ${e.error}` }, { status: 400 }); }
        await client.query('UPDATE society_events SET title = $1, description = $2, location = $3, updated_at = now() WHERE id = $4',
          // Back to the Society's usual rule: encrypted with its key if it's private
          [await sealText(a.societyId, e.title), await sealText(a.societyId, e.description), await sealText(a.societyId, e.location), r.id]);
      }
      await client.query('DELETE FROM sealed_item_keys WHERE item_type = $1 AND item_id = $2', ['calendar', sealed.id]);
      await client.query(`DELETE FROM society_sealed_sections WHERE customer_id = $1 AND section = 'calendar'`, [a.societyId]);
    } else {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

export const POST = lockSafe(handlePOST);
