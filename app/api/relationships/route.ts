import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

const PF_ALLOWED_CHILDREN: Record<string, string[]> = {
  resolution: ['framework', 'claim'],
  framework:  ['warrant', 'evidence', 'rebuttal'],
  claim:      ['warrant', 'evidence', 'impact', 'rebuttal'],
  warrant:    ['evidence', 'rebuttal'],
  evidence:   ['rebuttal'],
  impact:     ['warrant', 'evidence', 'rebuttal'],
  rebuttal:   ['warrant', 'evidence', 'turn', 'rebuttal'],
  turn:       ['warrant', 'evidence', 'rebuttal'],
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await req.json();
  const { parentId, childId } = body;

  if (!parentId || !childId) {
    return NextResponse.json({ error: 'Missing parentId or childId' }, { status: 400 });
  }
  if (parentId === childId) {
    return NextResponse.json({ error: 'Cannot link a statement to itself' }, { status: 400 });
  }

  const { rows } = await pool.query(
    'SELECT id, stat_type FROM statements WHERE id = ANY($1::uuid[])',
    [[parentId, childId]],
  );
  const byId = new Map(rows.map((r: { id: string; stat_type: string }) => [r.id, r]));
  const parent = byId.get(parentId);
  const child  = byId.get(childId);

  if (!parent) return NextResponse.json({ error: 'Parent statement not found' }, { status: 404 });
  if (!child)  return NextResponse.json({ error: 'Child statement not found' },  { status: 404 });

  const allowed = PF_ALLOWED_CHILDREN[parent.stat_type] ?? [];
  if (!allowed.includes(child.stat_type)) {
    return NextResponse.json(
      { error: `A ${child.stat_type} cannot connect to a ${parent.stat_type} under debate rules` },
      { status: 422 },
    );
  }

  try {
    await pool.query(
      `INSERT INTO stat_relationships (stat_id_supported, stat_id_supported_by, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [parentId, childId, session.sub],
    );
    return NextResponse.json(
      { relationship: { stat_id_supported: parentId, stat_id_supported_by: childId } },
      { status: 201 },
    );
  } catch (err) {
    console.error('Create relationship failed:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
