import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { sealText } from '@/lib/societyCrypto';
import { LEVELS, projectContext, RAID_KINDS, RAID_STATUSES, text, ptext } from '@/lib/projects';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; pid: string }> };

// POST { kind, name, description?, impact, likelihood, status? } — any Society
// member logs a Risk, Issue, Dependency or Assumption.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const c = await projectContext(req, id, pid);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.canContribute) return NextResponse.json({ error: 'Only members of this Society can add RAID items' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = ptext(c, b.name, 200);
  if (!(RAID_KINDS as readonly string[]).includes(b.kind)) return NextResponse.json({ error: 'Choose Risk, Issue, Dependency or Assumption' }, { status: 400 });
  if (!name) return NextResponse.json({ error: 'A name is required' }, { status: 400 });
  const lvl = (v: unknown) => (LEVELS as readonly string[]).includes(v as string) ? v : 'medium';
  const status = (RAID_STATUSES as readonly string[]).includes(b.status) ? b.status : 'open';
  const { rows: [r] } = await pool.query(
    `INSERT INTO project_raid (project_id, kind, name, description, impact, likelihood, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [pid, b.kind, await sealText(c.a.societyId, name), await sealText(c.a.societyId, ptext(c, b.description, 5000)), lvl(b.impact), lvl(b.likelihood), status, c.me],
  );
  return NextResponse.json({ id: r.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
