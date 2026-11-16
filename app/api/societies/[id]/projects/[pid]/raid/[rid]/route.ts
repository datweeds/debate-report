import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { LEVELS, projectContext, RAID_KINDS, RAID_STATUSES, text, UUID_RE } from '@/lib/projects';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pid: string; rid: string }> };

async function load(pid: string, rid: string) {
  if (!UUID_RE.test(rid)) return null;
  const { rows: [r] } = await pool.query('SELECT id, created_by FROM project_raid WHERE id = $1 AND project_id = $2', [rid, pid]);
  return r ?? null;
}

// PATCH — whoever logged it, the PM or a moderator: any field, e.g. status → mitigated / closed.
async function handlePATCH(req: NextRequest, { params }: Params) {
  const { id, pid, rid } = await params;
  const c = await projectContext(req, id, pid);
  const item = c ? await load(pid, rid) : null;
  if (!c || !item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (item.created_by !== c.me && !c.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const sets: string[] = []; const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if ('kind' in b && (RAID_KINDS as readonly string[]).includes(b.kind)) set('kind', b.kind);
  if ('name' in b) { const n = text(b.name, 200); if (!n) return NextResponse.json({ error: 'A name is required' }, { status: 400 }); set('name', await sealText(c.a.societyId, n)); }
  if ('description' in b) set('description', await sealText(c.a.societyId, text(b.description, 5000)));
  if ('impact' in b && (LEVELS as readonly string[]).includes(b.impact)) set('impact', b.impact);
  if ('likelihood' in b && (LEVELS as readonly string[]).includes(b.likelihood)) set('likelihood', b.likelihood);
  if ('status' in b && (RAID_STATUSES as readonly string[]).includes(b.status)) set('status', b.status);
  if (sets.length) {
    vals.push(rid);
    await pool.query(`UPDATE project_raid SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`, vals);
  }
  return NextResponse.json({ ok: true });
}

async function handleDELETE(req: NextRequest, { params }: Params) {
  const { id, pid, rid } = await params;
  const c = await projectContext(req, id, pid);
  const item = c ? await load(pid, rid) : null;
  if (!c || !item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (item.created_by !== c.me && !c.canManage) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await pool.query('DELETE FROM project_raid WHERE id = $1', [rid]);
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
export const DELETE = lockSafe(handleDELETE);
