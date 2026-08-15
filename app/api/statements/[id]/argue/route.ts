import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

const QUOTA: Record<string, number> = { debater: 10, moderator: 50, sysadmin: 50 };

// ── GET — latest session for this statement ───────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { rows: [row] } = await pool.query(
    `SELECT id, results, created_at
     FROM ai_arg_sessions
     WHERE user_id = $1 AND statement_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [session.sub, id],
  );

  const { rows: [usage] } = await pool.query(
    `SELECT COUNT(*)::int AS used
     FROM ai_arg_usage
     WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())`,
    [session.sub],
  );

  const tier   = session.tier as string;
  const quota  = QUOTA[tier] ?? 0;
  const used   = usage?.used ?? 0;

  return NextResponse.json({
    session: row ?? null,
    quota,
    used,
    remaining: Math.max(0, quota - used),
  });
}

// ── POST — generate arguments ─────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const tier = session.tier as string;
  if (!QUOTA[tier]) {
    return NextResponse.json({ error: 'Debater or Moderator tier required' }, { status: 403 });
  }

  // Quota check
  const { rows: [usage] } = await pool.query(
    `SELECT COUNT(*)::int AS used
     FROM ai_arg_usage
     WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())`,
    [session.sub],
  );
  const used  = usage?.used ?? 0;
  const quota = QUOTA[tier];
  if (used >= quota) {
    return NextResponse.json({ error: `Monthly quota of ${quota} reached` }, { status: 429 });
  }

  // Fetch statement + resolution
  const { rows: [stmt] } = await pool.query(
    `SELECT s.id, s.stat_type, s.stat_title, s.stat_description, s.stat_direction,
            s.resolution_id,
            r.stat_title AS res_title, r.stat_description AS res_desc
     FROM statements s
     LEFT JOIN statements r ON r.id = s.resolution_id
     WHERE s.id = $1`,
    [id],
  );
  if (!stmt) return NextResponse.json({ error: 'Statement not found' }, { status: 404 });

  const isResolution = !stmt.resolution_id;
  const resTitle     = isResolution ? stmt.stat_title : (stmt.res_title ?? '');
  const resDesc      = isResolution ? stmt.stat_description : (stmt.res_desc ?? '');
  const stmtTitle    = stmt.stat_title;
  const stmtDesc     = stmt.stat_description ?? '';
  const direction    = stmt.stat_direction ? `Direction: ${stmt.stat_direction} the resolution` : '';
  const resolutionId = stmt.resolution_id ?? id;

  const prompt = `You are an expert debate analyst and argumentation researcher. Analyse the following statement within the context of a debate resolution and generate well-grounded arguments. Prioritise empirical evidence, academic research, and established principles over opinions.

**Resolution:** ${resTitle}
${resDesc ? resDesc : ''}

**Statement under analysis:** ${stmtTitle}
${stmtDesc ? stmtDesc : ''}
${direction}

Generate a structured argument analysis. Return ONLY valid JSON — no preamble, no markdown fences:

{
  "for": [
    {
      "claim": "A specific, falsifiable claim that supports the statement (1-2 sentences)",
      "claim_desc": "2-3 sentences expanding on this claim with context and nuance",
      "evidence": "The specific evidence, study, data point, or established principle (1 sentence)",
      "evidence_desc": "2-3 sentences describing the evidence source and what it demonstrates",
      "warrant": "Why this evidence supports the claim in this debate context (1 sentence)",
      "warrant_desc": "2-3 sentences explaining the logical link between evidence and claim",
      "strength": 8,
      "strength_label": "Strong"
    }
  ],
  "against": [
    { ...same structure... }
  ],
  "rebuttals": [
    {
      "rebuts": "Claim 6",
      "claim": "A specific, falsifiable counter-argument that undermines the referenced Against claim (1-2 sentences)",
      "claim_desc": "2-3 sentences expanding on this rebuttal with context and nuance",
      "evidence": "The specific evidence, study, data point, or established principle (1 sentence)",
      "evidence_desc": "2-3 sentences describing the evidence source and what it demonstrates",
      "warrant": "Why this evidence supports the rebuttal in this debate context (1 sentence)",
      "warrant_desc": "2-3 sentences explaining the logical link between evidence and rebuttal",
      "strength": 8,
      "strength_label": "Strong"
    }
  ]
}

Rules:
- Provide up to 4 arguments in "for" (supporting the statement) — these are claims 1 through 4
- Provide up to 4 arguments in "against" (opposing the statement) — these are claims 5 through 8
- Provide up to 2 "rebuttals" — powerful counter-arguments that each undermine one specific Against claim
- For each rebuttal, set "rebuts" to the claim it targets, e.g. "Claim 5" or "Claim 7"
- Rate strength 1-10: 1-3 = Weak, 4-6 = Moderate, 7-8 = Strong, 9-10 = Very Strong
- Rank arguments from strongest to weakest within each group
- Return ONLY valid JSON`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let results: object;
  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-5',
      max_tokens: 8000,
      messages:   [{ role: 'user', content: prompt }],
    });
    const textBlock = message.content.find(b => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '';
    // Extract JSON object — strip any markdown fences and leading/trailing text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Argue: no JSON in response, text was:', text.substring(0, 500));
      throw new Error('No JSON object in response');
    }
    results = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('AI argue error:', err);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }

  // Save session + log usage in a transaction
  const client2 = await pool.connect();
  let newSession: { id: string; results: object };
  try {
    await client2.query('BEGIN');
    const { rows: [sess] } = await client2.query(
      `INSERT INTO ai_arg_sessions (user_id, statement_id, resolution_id, results)
       VALUES ($1, $2, $3, $4)
       RETURNING id, results`,
      [session.sub, id, resolutionId, JSON.stringify(results)],
    );
    await client2.query(
      'INSERT INTO ai_arg_usage (user_id, statement_id) VALUES ($1, $2)',
      [session.sub, id],
    );
    await client2.query('COMMIT');
    newSession = sess;
  } catch (err) {
    await client2.query('ROLLBACK');
    console.error('Session save error:', err);
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
  } finally {
    client2.release();
  }

  return NextResponse.json({
    session:   newSession,
    quota,
    used:      used + 1,
    remaining: Math.max(0, quota - used - 1),
  });
}
