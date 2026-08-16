import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import pool, { tq } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { canManageDebates } from '@/lib/roles';

export const maxDuration = 120;
const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

// ── GET — fetch latest analysis for an entity ─────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  const { searchParams } = new URL(req.url);
  const entity_type = searchParams.get('entity_type');
  const entity_id   = searchParams.get('entity_id');
  const topic_id    = searchParams.get('topic_id');

  if (!entity_type || !entity_id) {
    return NextResponse.json({ error: 'entity_type and entity_id required' }, { status: 400 });
  }

  const whereExtra = topic_id ? 'AND topic_id = $4' : '';
  const args: unknown[] = [TENANT_ID, entity_type, parseInt(entity_id, 10)];
  if (topic_id) args.push(parseInt(topic_id, 10));

  const { rows } = await pool.query(
    `SELECT id, topic_id, status, overall_score, report, notes, error_message, created_at, updated_at,
            t.name AS topic_name
     FROM society_impact_analyses s
     JOIN nsp_topics t ON t.id = s.topic_id
     WHERE s.tenant_id = $1 AND s.entity_type = $2 AND s.entity_id = $3 ${whereExtra}
     ORDER BY s.updated_at DESC`,
    args
  );

  // Non-logged-in users see only the existence + score (not full report)
  if (!session) {
    return NextResponse.json({
      analyses: rows.map(r => ({
        id: r.id, topic_id: r.topic_id, topic_name: r.topic_name,
        status: r.status, overall_score: r.overall_score, created_at: r.created_at,
      }))
    });
  }

  return NextResponse.json({ analyses: rows });
}

// ── POST — trigger a new analysis (or re-run with notes) ─────────────────────

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!await canManageDebates(session, TENANT_ID)) {
    return NextResponse.json({ error: 'Topic Owner or Customer Admin required' }, { status: 403 });
  }

  const { entity_type, entity_id, topic_id, notes } = await req.json();
  if (!['bill', 'proposal'].includes(entity_type) || !entity_id || !topic_id) {
    return NextResponse.json({ error: 'entity_type (bill|proposal), entity_id, topic_id required' }, { status: 400 });
  }

  // Fetch entity details
  let entityTitle = '', entityBody = '';
  if (entity_type === 'bill') {
    const { rows: [b] } = await pool.query(
      `SELECT b.full_name, b.synopsis,
              bt.name AS bill_type,
              (SELECT bst.name FROM sp_bill_stages bs JOIN sp_bill_stage_types bst ON bst.id = bs.bill_stage_type_id
               WHERE bs.bill_id = b.id ORDER BY bs.stage_date DESC NULLS LAST LIMIT 1) AS current_stage
       FROM sp_bills b LEFT JOIN sp_bill_types bt ON bt.id = b.bill_type_id WHERE b.id = $1`,
      [entity_id]
    );
    if (!b) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    entityTitle = b.full_name;
    entityBody  = [b.synopsis, b.bill_type ? `Type: ${b.bill_type}` : null, b.current_stage ? `Stage: ${b.current_stage}` : null].filter(Boolean).join('\n');
  } else {
    const { rows: [p] } = await tq(
      `SELECT title, description FROM proposals WHERE id = $1`, [entity_id]
    );
    if (!p) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    entityTitle = p.title;
    entityBody  = p.description ?? '';
  }

  // Fetch principles for the topic
  const { rows: principles } = await tq(
    `SELECT p.id, p.title, p.body, p.grounding
     FROM nsp_principles p
     JOIN nsp_principle_sets ps ON ps.id = p.set_id
     WHERE ps.topic_id = $1 AND ps.is_current = true
     ORDER BY p.sort_order, p.id`,
    [topic_id]
  );
  if (!principles.length) {
    return NextResponse.json({ error: 'No principles found for this topic' }, { status: 404 });
  }

  const { rows: [topic] } = await tq(
    `SELECT name FROM nsp_topics WHERE id = $1`, [topic_id]
  );
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 });

  // Upsert analysis row with status=running
  const { rows: [row] } = await pool.query(
    `INSERT INTO society_impact_analyses
       (tenant_id, entity_type, entity_id, topic_id, trigger_user_id, notes, status)
     VALUES ($1, $2, $3, $4, $5::uuid, $6, 'running')
     ON CONFLICT (tenant_id, entity_type, entity_id, topic_id)
     DO UPDATE SET status = 'running', notes = EXCLUDED.notes, trigger_user_id = EXCLUDED.trigger_user_id, updated_at = now()
     RETURNING id`,
    [TENANT_ID, entity_type, entity_id, topic_id, session.sub, notes?.trim() ?? null]
  );

  // Add unique constraint if missing
  const analysisId = row.id;

  const principleList = principles.map((p, i) =>
    `${i + 1}. **${p.title}**\nDefinition: ${p.body}${p.grounding ? `\nGrounded in: ${p.grounding}` : ''}`
  ).join('\n\n');

  const notesSection = notes?.trim()
    ? `\n\n**Topic Owner Contextual Notes:**\n${notes.trim()}\nPlease take these notes into account when assessing impact.`
    : '';

  const prompt = `You are an expert policy analyst specialising in constitutional principles and legislation.

Analyse the following ${entity_type === 'bill' ? 'Scottish Parliament Bill' : 'Community Proposal'} and assess how it would either strengthen or weaken the implementation of each principle listed below.

**${entity_type === 'bill' ? 'Bill' : 'Proposal'}: ${entityTitle}**
${entityBody}${notesSection}

**Topic: ${topic.name}**
**Principles to assess:**

${principleList}

For each principle, provide:
1. A score from 1 to 10 (1 = severely undermines the principle, 5 = neutral/no impact, 10 = strongly implements/reinforces the principle)
2. A list of specific sections, clauses, or aspects of the ${entity_type} that impact this principle, with a brief explanation of how

Also provide a short overall summary (2-3 sentences) of the ${entity_type}'s general relationship to these principles.

Return ONLY valid JSON in this exact structure (no preamble, no markdown fences):

{
  "summary": "2-3 sentence overall assessment",
  "scores": [
    {
      "principle_id": <integer — the principle number from the list above, 1-indexed>,
      "principle_title": "<exact title>",
      "score": <integer 1-10>,
      "score_label": "<Strongly Undermines|Undermines|Neutral|Supports|Strongly Supports>",
      "impacts": [
        {
          "section": "<section/clause reference or 'General' if no specific clause>",
          "description": "<1-2 sentences explaining the specific impact>"
        }
      ]
    }
  ]
}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let report: object;
  let msgUsage: { input_tokens: number; output_tokens: number } | null = null;

  try {
    const message = await client.messages.create({
      model:      'claude-sonnet-5',
      max_tokens: 8000,
      messages:   [{ role: 'user', content: prompt }],
    });
    msgUsage = message.usage;
    const textBlock = message.content.find(b => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    report = JSON.parse(jsonMatch[0]);
  } catch (err) {
    await pool.query(
      `UPDATE society_impact_analyses SET status='failed', error_message=$1, updated_at=now() WHERE id=$2`,
      [String(err), analysisId]
    );
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }

  // Calculate overall score
  const scores = (report as { scores?: Array<{ score: number }> }).scores ?? [];
  const overall = scores.length
    ? parseFloat((scores.reduce((s, p) => s + p.score, 0) / scores.length).toFixed(2))
    : null;

  await pool.query(
    `UPDATE society_impact_analyses
     SET status='done', report=$1, overall_score=$2, updated_at=now()
     WHERE id=$3`,
    [JSON.stringify(report), overall, analysisId]
  );

  // Log token usage — Sonnet 5: $3/1M input (3 µ$/tok), $15/1M output (15 µ$/tok)
  if (msgUsage) {
    const cost = msgUsage.input_tokens * 3 + msgUsage.output_tokens * 15;
    pool.query(
      `INSERT INTO ai_usage_log
         (tenant_id, analysis_type, entity_type, entity_id, topic_id, model, input_tokens, output_tokens, cost_micro)
       VALUES ($1,'heavy',$2,$3,$4,'claude-sonnet-5',$5,$6,$7)`,
      [TENANT_ID, entity_type, entity_id, topic_id,
       msgUsage.input_tokens, msgUsage.output_tokens, cost]
    ).catch(() => {}); // non-blocking; don't fail the analysis if logging fails
  }

  return NextResponse.json({ id: analysisId, overall_score: overall, report }, { status: 201 });
}
