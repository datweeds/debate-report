import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [stmt] } = await pool.query(
    'SELECT science_analysis_id FROM statements WHERE id = $1',
    [id],
  );
  if (!stmt?.science_analysis_id) return NextResponse.json({ analysis: null, refs: [] });

  const [{ rows: [analysis] }, { rows: refs }] = await Promise.all([
    pool.query('SELECT * FROM science_analyses WHERE id = $1', [stmt.science_analysis_id]),
    pool.query(
      'SELECT side, position, title, summary, link FROM science_analysis_refs WHERE analysis_id = $1 ORDER BY side, position',
      [stmt.science_analysis_id],
    ),
  ]);

  return NextResponse.json({ analysis: analysis ?? null, refs });
}

export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [stmt] } = await pool.query(
    'SELECT stat_title, stat_description, science_analysis_id FROM statements WHERE id = $1',
    [id],
  );
  if (!stmt) return NextResponse.json({ error: 'Statement not found' }, { status: 404 });

  // Build claim: title + first 3 sentences of description
  const sentences = (stmt.stat_description ?? '')
    .split(/(?<=[.!?])\s+/)
    .slice(0, 3)
    .join(' ')
    .trim();
  const claim = [stmt.stat_title, sentences].filter(Boolean).join('. ');

  let sciData: {
    claim: string;
    pro_analysis: string;
    con_analysis: string;
    synthesis: string;
    references: {
      supporting: Record<string, { title: string; summary: string; link: string }>;
      opposing:   Record<string, { title: string; summary: string; link: string }>;
    };
  };

  try {
    const res = await fetch('https://thescience.app/api/analyze', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    process.env.SCIENCE_API_KEY ?? '',
      },
      body: JSON.stringify({ claim }),
    });
    if (!res.ok) throw new Error(`Science API ${res.status}`);
    sciData = await res.json();
  } catch (err) {
    console.error('Science API error:', err);
    return NextResponse.json({ error: 'Science analysis failed' }, { status: 502 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete old analysis if present (cascade deletes refs)
    if (stmt.science_analysis_id) {
      await client.query('DELETE FROM science_analyses WHERE id = $1', [stmt.science_analysis_id]);
    }

    // Insert new analysis
    const { rows: [newAnalysis] } = await client.query(
      `INSERT INTO science_analyses (statement_id, claim, pro_analysis, con_analysis, synthesis)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, sciData.claim, sciData.pro_analysis, sciData.con_analysis, sciData.synthesis],
    );

    // Insert refs
    const refRows: { side: 'supporting' | 'opposing'; pos: number; ref: { title: string; summary: string; link: string } }[] = [];
    for (const [pos, ref] of Object.entries(sciData.references.supporting)) {
      refRows.push({ side: 'supporting', pos: parseInt(pos), ref: ref as { title: string; summary: string; link: string } });
    }
    for (const [pos, ref] of Object.entries(sciData.references.opposing)) {
      refRows.push({ side: 'opposing', pos: parseInt(pos), ref: ref as { title: string; summary: string; link: string } });
    }
    for (const { side, pos, ref } of refRows) {
      await client.query(
        `INSERT INTO science_analysis_refs (analysis_id, side, position, title, summary, link)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newAnalysis.id, side, pos, ref.title, ref.summary, ref.link],
      );
    }

    // Link analysis to statement
    await client.query(
      'UPDATE statements SET science_analysis_id = $1 WHERE id = $2',
      [newAnalysis.id, id],
    );

    await client.query('COMMIT');

    const { rows: refs } = await client.query(
      'SELECT side, position, title, summary, link FROM science_analysis_refs WHERE analysis_id = $1 ORDER BY side, position',
      [newAnalysis.id],
    );

    return NextResponse.json({ analysis: newAnalysis, refs });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Science save error:', err);
    return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 });
  } finally {
    client.release();
  }
}
