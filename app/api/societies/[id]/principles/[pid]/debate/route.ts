import { NextRequest, NextResponse } from 'next/server';
import { principlesSealedCheck } from '@/lib/principles';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { currentPrinciple } from '@/lib/principles';
import { lockSafe } from '@/lib/lockSafe';
import { sealNewDebate } from '@/lib/debateCrypto';
import { sealedSection } from '@/lib/sealed/server';

// What a principle's debate says about it (the browser builds the same for sealed debates)
const principleDebateText = (p: { body: string; grounding: string | null }) =>
  `${p.body}${p.grounding ? `\n\nWhy: ${p.grounding}` : ''}\n\nOne of this Society's principles. Argue for keeping it as it is, or against (and how it should change).`;

type Params = { params: Promise<{ id: string; pid: string }> };

// POST — moderators open a debate on the principle (a resolution in this
// Society that members argue and vote on). Returns the existing one if there is one.
// When the Society's debates are sealed, the browser sends the new debate's
// { title, description }, sealed with the debates' keys.
async function handlePOST(req: NextRequest, { params }: Params) {
  const { id, pid } = await params;
  const a = await societyContentAccess(req, id);
  const debates = a ? await sealedSection(a.societyId, 'debates') : null;
  // A debate would reveal sealed principles' text unless the debates are sealed too
  if (a && !debates && await principlesSealedCheck(a.societyId)) return NextResponse.json({ error: 'Sealed principles can only be put to a debate when the Society’s debates are sealed too' }, { status: 409 });
  const p = a ? await currentPrinciple(a.societyId, pid) : null;
  if (!a || !p) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: [link] } = await pool.query(
    `SELECT l.resolution_id FROM society_principle_links l
     JOIN statements r ON r.id = l.resolution_id AND r.stat_status <> 'deleted'
     WHERE l.lineage_id = $1`, [p.lineage_id]);
  if (link?.resolution_id) return NextResponse.json({ resolutionId: link.resolution_id });
  if (!a.canModerate) return NextResponse.json({ error: 'Only moderators can open a debate' }, { status: 403 });
  const b = debates ? await req.json().catch(() => ({})) : {};
  if (debates && (typeof b.title !== 'string' || typeof b.description !== 'string')) {
    return NextResponse.json({ error: 'This Society’s debates are sealed', sealedDebates: { id: debates.id } }, { status: 409 });
  }

  const { rows: [r] } = await pool.query(
    `INSERT INTO statements (stat_type, stat_title, stat_description, subject_area, created_by, customer_id)
     VALUES ('resolution', $1, $2, 'philosophy', $3, $4) RETURNING id`,
    [await sealNewDebate(a.societyId, debates ? b.title : `This Society should keep the principle: ${p.title}`.slice(0, 500)),
     await sealNewDebate(a.societyId, debates ? b.description : principleDebateText(p)),
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
