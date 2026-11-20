import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { checkDraft } from '@/lib/quality/rules';
import { getDebate, loadDebate } from '@/lib/quality/report';
import { hideEndToEnd, openDeep } from '@/lib/societyCrypto';

// GET — the statements this user has written, newest first, each with the
// same quality warnings shown while writing, so they can go back and fix them.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows } = await pool.query(
    `SELECT s.id, s.stat_ref, s.stat_type::text AS stat_type, s.stat_direction::text AS stat_direction,
            s.stat_title, s.created_at, s.retracted_at, s.resolution_id,
            r.stat_title AS resolution_title, c.name AS society_name
     FROM   statements s
     JOIN   statements r ON r.id = s.resolution_id
     LEFT   JOIN customers c ON c.id = r.customer_id
     WHERE  s.created_by = $1 AND s.stat_type <> 'resolution'
     ORDER  BY s.created_at DESC
     LIMIT  300`,
    [session.sub],
  );

  // Load each debate once and run the statement checks against it
  const warnings = new Map<string, { severity: string; observation: string; recommendation: string }[]>();
  await openDeep(rows);
  await hideEndToEnd(rows);  // sealed debates: only members' browsers can open them
  for (const resId of new Set(rows.filter(r => !r.retracted_at).map(r => r.resolution_id as string))) {
    const res = await getDebate(resId);
    if (!res || res.stat_title?.startsWith('sn1:')) continue;   // sealed debates: the checks can't read them here
    const debate = await loadDebate(res);
    for (const s of debate.statements) {
      if (!rows.some(r => r.id === s.id) || s.retracted_at) continue;
      warnings.set(s.id, checkDraft({ ...s, stat_ref: s.stat_ref ?? null }, debate)
        .map(({ severity, observation, recommendation }) => ({ severity, observation, recommendation })));
    }
  }

  return NextResponse.json({
    statements: rows.map(r => ({ ...r, warnings: warnings.get(r.id) ?? [] })),
  });
}
