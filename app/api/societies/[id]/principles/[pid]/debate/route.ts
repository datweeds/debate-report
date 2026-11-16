import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { currentPrinciple } from '@/lib/principles';
import { lockSafe } from '@/lib/lockSafe';
import { sealText } from '@/lib/societyCrypto';

type Params = { params: Promise<{ id: string; pid: string }> };

// POST — moderators open a debate on the principle (a resolution in this
// Society that members argue and vote on). Returns the existing one if there is one.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const a = await societyContentAccess(req, id);
  const p = a ? await currentPrinciple(a.societyId, pid) : null;
  if (!a || !p) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: [link] } = await pool.query(
    `SELECT l.resolution_id FROM society_principle_links l
     JOIN statements r ON r.id = l.resolution_id AND r.stat_status <> 'deleted'
     WHERE l.lineage_id = $1`, [p.lineage_id]);
  if (link?.resolution_id) return NextResponse.json({ resolutionId: link.resolution_id });
  if (!a.canModerate) return NextResponse.json({ error: 'Only moderators can open a debate' }, { status: 403 });

  const { rows: [r] } = await pool.query(
    `INSERT INTO statements (stat_type, stat_title, stat_description, subject_area, created_by, customer_id)
     VALUES ('resolution', $1, $2, 'philosophy', $3, $4) RETURNING id`,
    [await sealText(a.societyId, `This Society should keep the principle: ${p.title}`.slice(0, 500)),
     await sealText(a.societyId, `${p.body}${p.grounding ? `\n\nWhy: ${p.grounding}` : ''}\n\nOne of this Society's principles. Argue for keeping it as it is, or against (and how it should change).`),
     a.session!.sub, a.societyId],
  );
  await pool.query(
    `INSERT INTO society_principle_links (lineage_id, customer_id, resolution_id) VALUES ($1, $2, $3)
     ON CONFLICT (lineage_id) DO UPDATE SET resolution_id = EXCLUDED.resolution_id`,
    [p.lineage_id, a.societyId, r.id],
  );
  return NextResponse.json({ resolutionId: r.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
