import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { scanContent } from '@/lib/scanner';

const VALID_TYPES = ['framework', 'claim', 'warrant', 'evidence', 'impact', 'rebuttal', 'turn'] as const;

// PF debate rules — must mirror frontend constants
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
  const { parentId, resolutionId, statType, statTitle, statDirection, statDescription } = body;

  // Validate inputs
  if (!parentId || !resolutionId || !statType || !statTitle) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (!VALID_TYPES.includes(statType as typeof VALID_TYPES[number])) {
    return NextResponse.json({ error: 'Invalid statement type' }, { status: 400 });
  }
  if (statDirection && statDirection !== 'for' && statDirection !== 'against') {
    return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
  }

  // Validate parent exists and get its type
  const { rows: [parent] } = await pool.query(
    'SELECT id, stat_type FROM statements WHERE id = $1',
    [parentId],
  );
  if (!parent) return NextResponse.json({ error: 'Parent statement not found' }, { status: 404 });

  // Enforce PF rules
  const allowed = PF_ALLOWED_CHILDREN[parent.stat_type] ?? [];
  if (!allowed.includes(statType)) {
    return NextResponse.json(
      { error: `A ${statType} cannot be connected to a ${parent.stat_type} under debate rules` },
      { status: 422 },
    );
  }

  // Create statement + relationship in a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [statement] } = await client.query(
      `INSERT INTO statements
         (stat_type, stat_title, stat_direction, stat_description, resolution_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, stat_type, stat_title, stat_direction, stat_description,
                 resolution_id, created_by, retracted_at, created_at`,
      [statType, statTitle.trim(), statDirection ?? null, statDescription?.trim() ?? null, resolutionId, session.sub],
    );

    // stat_id_supported = parent (what's being supported)
    // stat_id_supported_by = new child (the supporter)
    await client.query(
      'INSERT INTO stat_relationships (stat_id_supported, stat_id_supported_by, created_by) VALUES ($1, $2, $3)',
      [parentId, statement.id, session.sub],
    );

    await client.query('COMMIT');

    const relationship = { stat_id_supported: parentId, stat_id_supported_by: statement.id };

    // Async scan — does not block response
    void scanContent(statTitle.trim(), 'statement_title', statement.id, resolutionId, session.sub);
    if (statDescription?.trim()) {
      void scanContent(statDescription.trim(), 'statement_description', statement.id, resolutionId, session.sub);
    }

    return NextResponse.json({ statement, relationship }, { status: 201 });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create statement failed:', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  } finally {
    client.release();
  }
}
