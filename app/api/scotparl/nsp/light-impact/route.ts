import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import pool, { tq } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { canManageDebates } from '@/lib/roles';

const TENANT_ID = parseInt(process.env.TENANT_ID ?? '1', 10);

export const maxDuration = 300;

const MODEL        = 'claude-haiku-4-5';
const BATCH_SIZE   = 200;
const CONCURRENCY  = 20;

const INPUT_MICRO_PER_TOKEN  = 1;
const OUTPUT_MICRO_PER_TOKEN = 5;

function costMicro(inputTok: number, outputTok: number) {
  return inputTok * INPUT_MICRO_PER_TOKEN + outputTok * OUTPUT_MICRO_PER_TOKEN;
}

type TopicRow = { id: number; name: string; description: string | null };
type TopicWithPrinciples = TopicRow & { principleList: string };
type PrincipleRow = { title: string };
type EntityRow = { entity_type: string; entity_id: number; synopsis: string };

// ── GET — status for the admin dashboard ─────────────────────────────────────

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !await canManageDebates(session, TENANT_ID)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [topicsRes, statsRes, budgetRes] = await Promise.all([
    tq<{
      id: number; name: string; description: string | null;
      last_run_at: string | null;
      scored_count: number;
      principles_changed_at: string | null;
    }>(`
      SELECT
        nt.id, nt.name, nt.description,
        MAX(la.created_at)::text                                                AS last_run_at,
        COUNT(DISTINCT la.id)::int                                              AS scored_count,
        MAX(np.updated_at)::text                                                AS principles_changed_at
      FROM nsp_topics nt
      LEFT JOIN nsp_principle_sets nps ON nps.topic_id = nt.id AND nps.is_current = true
      LEFT JOIN nsp_principles np      ON np.set_id = nps.id
      LEFT JOIN society_light_analyses la ON la.topic_id = nt.id
        AND la.tenant_id = current_setting('app.tenant_id')::int
      WHERE nt.tenant_id = current_setting('app.tenant_id')::int
      GROUP BY nt.id, nt.name
      ORDER BY nt.name
    `),

    tq<{
      month: string;
      analysis_type: string;
      calls: number;
      input_tokens: number;
      output_tokens: number;
      cost_micro: number;
    }>(`
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
        analysis_type,
        COUNT(*)::int                                         AS calls,
        SUM(input_tokens)::int                               AS input_tokens,
        SUM(output_tokens)::int                              AS output_tokens,
        SUM(cost_micro)::int                                 AS cost_micro
      FROM ai_usage_log
      WHERE tenant_id = current_setting('app.tenant_id')::int
        AND created_at >= date_trunc('month', now()) - interval '5 months'
      GROUP BY 1, 2
      ORDER BY 1 DESC, 2
    `),

    pool.query<{ ai_budget_cents: number | null }>(
      `SELECT ai_budget_cents FROM customers WHERE id = $1`, [TENANT_ID]
    ),
  ]);

  const [billCount, actCount, ssiCount, proposalCount] = await Promise.all([
    pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sp_bills`),
    pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sp_acts`),
    pool.query<{ c: number }>(`SELECT COUNT(*)::int AS c FROM sp_ssis`),
    tq<{ c: number }>(`SELECT COUNT(*)::int AS c FROM proposals`),
  ]);
  const totalEntities =
    (billCount.rows[0]?.c ?? 0) +
    (actCount.rows[0]?.c ?? 0) +
    (ssiCount.rows[0]?.c ?? 0) +
    (proposalCount.rows[0]?.c ?? 0);

  const topics = topicsRes.rows.map(t => ({
    ...t,
    total_entities: totalEntities,
    pending_count:  totalEntities - t.scored_count,
    principles_stale:
      t.last_run_at !== null &&
      t.principles_changed_at !== null &&
      t.principles_changed_at > t.last_run_at,
  }));

  const lastRes = await tq<{ last_analysed_at: string | null }>(
    `SELECT MAX(created_at)::text AS last_analysed_at FROM society_light_analyses`
  );

  return NextResponse.json({
    topics,
    stats:            statsRes.rows,
    budget:           budgetRes.rows[0]?.ai_budget_cents ?? null,
    last_analysed_at: lastRes.rows[0]?.last_analysed_at ?? null,
  });
}

// ── POST — trigger a light analysis run ──────────────────────────────────────
//
// Multi-topic mode (no topic_id): scores each entity once against ALL topics
// in a single API call — roughly 3× cheaper and 12× fewer API calls than
// running per-topic. Use this for the initial full sweep.
//
// Single-topic mode (topic_id given): scores entities for one topic only.
// Use this to re-run after updating a single topic's principles.

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !await canManageDebates(session, TENANT_ID)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    topic_id?:   number;
    full_rerun?: boolean;
    since_dt?:   string;   // ISO datetime — re-analyse entities last scored before this
  };

  const { topic_id, full_rerun = false, since_dt } = body;

  // Validate since_dt if provided
  const sinceDate = since_dt ? new Date(since_dt) : null;
  const sinceDateIso = sinceDate && !isNaN(sinceDate.getTime()) ? sinceDate.toISOString() : null;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  if (!topic_id) {
    return runMultiTopicMode(anthropic, full_rerun, sinceDateIso);
  } else {
    return runSingleTopicMode(anthropic, topic_id, full_rerun);
  }
}

// ── Multi-topic mode ──────────────────────────────────────────────────────────
// One API call per entity; all topics scored simultaneously.

async function runMultiTopicMode(anthropic: Anthropic, full_rerun: boolean, sinceDateIso: string | null = null) {
  // Load all topics with their current principles
  const topicsRes = await tq<TopicRow>(
    `SELECT id, name, description FROM nsp_topics
     WHERE tenant_id = current_setting('app.tenant_id')::int
     ORDER BY sort_order, name`
  );
  const topics = topicsRes.rows;
  if (topics.length === 0) {
    return NextResponse.json({ error: 'No topics found' }, { status: 404 });
  }

  // Enrich each topic with its principles
  const topicsWithPrinciples: TopicWithPrinciples[] = await Promise.all(
    topics.map(async (t) => {
      const pRes = await tq<PrincipleRow>(
        `SELECT np.title FROM nsp_principles np
         JOIN nsp_principle_sets nps ON nps.id = np.set_id
         WHERE nps.topic_id = $1 AND nps.is_current = true
         ORDER BY np.sort_order NULLS LAST, np.id`,
        [t.id]
      );
      const principleList = pRes.rows.length > 0
        ? pRes.rows.map(p => `  • ${p.title}`).join('\n')
        : t.description ?? '';
      return { ...t, principleList };
    })
  );

  if (full_rerun) {
    await pool.query(
      `DELETE FROM society_light_analyses WHERE tenant_id = $1`, [TENANT_ID]
    );
  }

  const entities = await getAllPendingEntities(topics.length, sinceDateIso);
  const totalRemaining = Math.max(0, entities.length - BATCH_SIZE);
  const batch = entities.slice(0, BATCH_SIZE);

  const results = await processMultiBatch(anthropic, topicsWithPrinciples, batch);

  let totalProcessed = 0;
  let totalCostMicro = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of results) {
      if (!r) continue;
      // One API call covers all topics — accumulate cost once per entity.
      const entityCost = costMicro(r.input_tokens, r.output_tokens);
      const nTopics    = r.scores.length || 1;
      // Apportion tokens evenly so per-topic usage log rows sum to the real call cost.
      const inPerTopic  = Math.round(r.input_tokens  / nTopics);
      const outPerTopic = Math.round(r.output_tokens / nTopics);
      const costPerTopic = Math.round(entityCost / nTopics);

      for (const s of r.scores) {
        await client.query(
          `INSERT INTO society_light_analyses
             (tenant_id, entity_type, entity_id, topic_id, score, rationale, synopsis_used, model, input_tokens, output_tokens)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (tenant_id, entity_type, entity_id, topic_id) DO UPDATE SET
             score         = EXCLUDED.score,
             rationale     = EXCLUDED.rationale,
             synopsis_used = EXCLUDED.synopsis_used,
             model         = EXCLUDED.model,
             input_tokens  = EXCLUDED.input_tokens,
             output_tokens = EXCLUDED.output_tokens,
             created_at    = now()`,
          [TENANT_ID, r.entity_type, r.entity_id, s.topic_id,
           s.score, s.rationale, r.synopsis_used,
           MODEL, inPerTopic, outPerTopic]
        );
        await client.query(
          `INSERT INTO ai_usage_log
             (tenant_id, analysis_type, entity_type, entity_id, topic_id, model, input_tokens, output_tokens, cost_micro)
           VALUES ($1,'light',$2,$3,$4,$5,$6,$7,$8)`,
          [TENANT_ID, r.entity_type, r.entity_id, s.topic_id,
           MODEL, inPerTopic, outPerTopic, costPerTopic]
        );
      }
      totalCostMicro += entityCost;
      totalProcessed++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({
    mode:       'multi-topic',
    processed:  totalProcessed,
    remaining:  totalRemaining,
    done:       totalRemaining === 0,
    cost_cents: (totalCostMicro / 10_000).toFixed(4),
  });
}

// ── Single-topic mode ─────────────────────────────────────────────────────────

async function runSingleTopicMode(anthropic: Anthropic, topic_id: number, full_rerun: boolean) {
  const topicsRes = await tq<TopicRow>(
    `SELECT id, name, description FROM nsp_topics WHERE id = $1 AND tenant_id = current_setting('app.tenant_id')::int`,
    [topic_id]
  );
  const topic = topicsRes.rows[0];
  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  const princRes = await tq<PrincipleRow>(
    `SELECT np.title FROM nsp_principles np
     JOIN nsp_principle_sets nps ON nps.id = np.set_id
     WHERE nps.topic_id = $1 AND nps.is_current = true
     ORDER BY np.sort_order NULLS LAST, np.id`,
    [topic.id]
  );
  const principles = princRes.rows;

  if (full_rerun) {
    await pool.query(
      `DELETE FROM society_light_analyses WHERE tenant_id = $1 AND topic_id = $2`,
      [TENANT_ID, topic.id]
    );
  }

  const entities = await getPendingEntities(topic.id);
  const totalRemaining = Math.max(0, entities.length - BATCH_SIZE);
  const batch = entities.slice(0, BATCH_SIZE);

  const results = await processBatch(anthropic, topic, principles, batch);

  let totalProcessed = 0;
  let totalCostMicro = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of results) {
      if (!r) continue;
      await client.query(
        `INSERT INTO society_light_analyses
           (tenant_id, entity_type, entity_id, topic_id, score, rationale, synopsis_used, model, input_tokens, output_tokens)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (tenant_id, entity_type, entity_id, topic_id) DO UPDATE SET
           score         = EXCLUDED.score,
           rationale     = EXCLUDED.rationale,
           synopsis_used = EXCLUDED.synopsis_used,
           model         = EXCLUDED.model,
           input_tokens  = EXCLUDED.input_tokens,
           output_tokens = EXCLUDED.output_tokens,
           created_at    = now()`,
        [TENANT_ID, r.entity_type, r.entity_id, topic.id,
         r.score, r.rationale, r.synopsis_used,
         MODEL, r.input_tokens, r.output_tokens]
      );
      await client.query(
        `INSERT INTO ai_usage_log
           (tenant_id, analysis_type, entity_type, entity_id, topic_id, model, input_tokens, output_tokens, cost_micro)
         VALUES ($1,'light',$2,$3,$4,$5,$6,$7,$8)`,
        [TENANT_ID, r.entity_type, r.entity_id, topic.id,
         MODEL, r.input_tokens, r.output_tokens,
         costMicro(r.input_tokens, r.output_tokens)]
      );
      totalCostMicro += costMicro(r.input_tokens, r.output_tokens);
      totalProcessed++;
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return NextResponse.json({
    mode:       'single-topic',
    processed:  totalProcessed,
    remaining:  totalRemaining,
    done:       totalRemaining === 0,
    cost_cents: (totalCostMicro / 10_000).toFixed(4),
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

// Entities pending for multi-topic mode.
// Without sinceDateIso: entities missing at least one topic score.
// With sinceDateIso: entities last scored before that datetime (or never scored).
async function getAllPendingEntities(topicCount: number, sinceDateIso: string | null = null): Promise<EntityRow[]> {
  const pendingClause = (entityType: string, idCol: string) => sinceDateIso
    ? `(SELECT COALESCE(MAX(la.created_at), '-infinity'::timestamptz) FROM society_light_analyses la
        WHERE la.entity_type = '${entityType}' AND la.entity_id = ${idCol} AND la.tenant_id = ${TENANT_ID}
       ) < '${sinceDateIso}'`
    : `(SELECT COUNT(DISTINCT la.topic_id) FROM society_light_analyses la
        WHERE la.entity_type = '${entityType}' AND la.entity_id = ${idCol} AND la.tenant_id = ${TENANT_ID}
       ) < ${topicCount}`;

  const [billsRes, actsRes, ssisRes, propsRes] = await Promise.all([
    pool.query<EntityRow>(`
      SELECT 'bill' AS entity_type, id AS entity_id,
             COALESCE(
               NULLIF(TRIM(COALESCE(short_name,'') || ' ' || COALESCE(synopsis,'')), ''),
               short_name
             ) AS synopsis
      FROM sp_bills b
      WHERE ${pendingClause('bill', 'b.id')}
      ORDER BY id DESC
    `),
    pool.query<EntityRow>(`
      SELECT 'act' AS entity_type, id AS entity_id, title AS synopsis
      FROM sp_acts a
      WHERE ${pendingClause('act', 'a.id')}
      ORDER BY year DESC, number DESC
    `),
    pool.query<EntityRow>(`
      SELECT 'ssi' AS entity_type, id AS entity_id, title AS synopsis
      FROM sp_ssis s
      WHERE ${pendingClause('ssi', 's.id')}
      ORDER BY year DESC, number DESC
    `),
    tq<EntityRow>(`
      SELECT 'proposal' AS entity_type, id AS entity_id,
             SUBSTRING(COALESCE(title,'') || ' ' || COALESCE(description,''), 1, 500) AS synopsis
      FROM proposals p
      WHERE ${pendingClause('proposal', 'p.id')}
      ORDER BY id DESC
    `),
  ]);

  const all: EntityRow[] = [];
  const lists = [billsRes.rows, actsRes.rows, ssisRes.rows, propsRes.rows];
  const maxLen = Math.max(...lists.map(l => l.length));
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (i < list.length) all.push(list[i]);
    }
  }
  return all;
}

// Entities missing a score for a specific topic (for single-topic mode)
async function getPendingEntities(topicId: number): Promise<EntityRow[]> {
  const [billsRes, actsRes, ssisRes, propsRes] = await Promise.all([
    pool.query<EntityRow>(`
      SELECT 'bill' AS entity_type, id AS entity_id,
             COALESCE(
               NULLIF(TRIM(COALESCE(short_name,'') || ' ' || COALESCE(synopsis,'')), ''),
               short_name
             ) AS synopsis
      FROM sp_bills b
      WHERE NOT EXISTS (
        SELECT 1 FROM society_light_analyses la
        WHERE la.entity_type = 'bill' AND la.entity_id = b.id
          AND la.topic_id = ${topicId} AND la.tenant_id = ${TENANT_ID}
      )
      ORDER BY id DESC
    `),
    pool.query<EntityRow>(`
      SELECT 'act' AS entity_type, id AS entity_id, title AS synopsis
      FROM sp_acts a
      WHERE NOT EXISTS (
        SELECT 1 FROM society_light_analyses la
        WHERE la.entity_type = 'act' AND la.entity_id = a.id
          AND la.topic_id = ${topicId} AND la.tenant_id = ${TENANT_ID}
      )
      ORDER BY year DESC, number DESC
    `),
    pool.query<EntityRow>(`
      SELECT 'ssi' AS entity_type, id AS entity_id, title AS synopsis
      FROM sp_ssis s
      WHERE NOT EXISTS (
        SELECT 1 FROM society_light_analyses la
        WHERE la.entity_type = 'ssi' AND la.entity_id = s.id
          AND la.topic_id = ${topicId} AND la.tenant_id = ${TENANT_ID}
      )
      ORDER BY year DESC, number DESC
    `),
    tq<EntityRow>(`
      SELECT 'proposal' AS entity_type, id AS entity_id,
             SUBSTRING(COALESCE(title,'') || ' ' || COALESCE(description,''), 1, 500) AS synopsis
      FROM proposals p
      WHERE NOT EXISTS (
        SELECT 1 FROM society_light_analyses la
        WHERE la.entity_type = 'proposal' AND la.entity_id = p.id
          AND la.topic_id = ${topicId} AND la.tenant_id = ${TENANT_ID}
      )
      ORDER BY id DESC
    `),
  ]);

  const all: EntityRow[] = [];
  const lists = [billsRes.rows, actsRes.rows, ssisRes.rows, propsRes.rows];
  const maxLen = Math.max(...lists.map(l => l.length));
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (i < list.length) all.push(list[i]);
    }
  }
  return all;
}

// ── Multi-topic batch processor ───────────────────────────────────────────────

type MultiAnalysisResult = {
  entity_type:   string;
  entity_id:     number;
  synopsis_used: string;
  input_tokens:  number;
  output_tokens: number;
  scores: { topic_id: number; score: number; rationale: string }[];
};

async function processMultiBatch(
  anthropic: Anthropic,
  topics: TopicWithPrinciples[],
  entities: EntityRow[],
): Promise<(MultiAnalysisResult | null)[]> {
  const topicBlock = topics.map(t =>
    `[${t.id}] ${t.name}\n${t.principleList}`
  ).join('\n\n');

  const results: (MultiAnalysisResult | null)[] = new Array(entities.length).fill(null);
  const chunks: EntityRow[][] = [];
  for (let i = 0; i < entities.length; i += CONCURRENCY) {
    chunks.push(entities.slice(i, i + CONCURRENCY));
  }

  let idx = 0;
  for (const chunk of chunks) {
    const settled = await Promise.allSettled(
      chunk.map(async (entity) => {
        const synopsis = entity.synopsis.slice(0, 600);

        const prompt =
`You are assessing Scottish legislation for relevance to each of ${topics.length} subject areas.

Item: ${synopsis}

Rate relevance to EACH subject area (1–10):
1–3 = minimal or no relevance
4–6 = moderate or indirect relevance
7–8 = significant relevance
9–10 = directly addresses this area

Subject areas:
${topicBlock}

Reply ONLY with a valid JSON array covering all ${topics.length} topic IDs:
[{"topic_id":N,"score":N,"rationale":"max 80 chars"}, ...]`;

        const msg = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = (msg.content[0] as { type: string; text: string }).text.trim();
        let scores: { topic_id: number; score: number; rationale: string }[] = [];
        try {
          const jsonPart = text.match(/\[[\s\S]*\]/)?.[0] ?? text;
          const parsed = JSON.parse(jsonPart) as { topic_id: unknown; score: unknown; rationale: unknown }[];
          scores = parsed.map(item => ({
            topic_id: Number(item.topic_id),
            score:    Math.max(1, Math.min(10, Math.round(Number(item.score) || 5))),
            rationale: String(item.rationale ?? '').slice(0, 120),
          })).filter(s => s.topic_id > 0);
        } catch {
          // If parse fails, skip this entity — don't persist partial garbage
          scores = [];
        }

        if (scores.length === 0) return null;

        return {
          entity_type:   entity.entity_type,
          entity_id:     entity.entity_id,
          synopsis_used: synopsis,
          input_tokens:  msg.usage.input_tokens,
          output_tokens: msg.usage.output_tokens,
          scores,
        };
      })
    );

    for (const res of settled) {
      results[idx++] = res.status === 'fulfilled' ? res.value : null;
    }
  }
  return results;
}

// ── Single-topic batch processor ──────────────────────────────────────────────

type AnalysisResult = {
  entity_type:   string;
  entity_id:     number;
  score:         number;
  rationale:     string;
  synopsis_used: string;
  input_tokens:  number;
  output_tokens: number;
};

async function processBatch(
  anthropic: Anthropic,
  topic: TopicRow,
  principles: PrincipleRow[],
  entities: EntityRow[],
): Promise<(AnalysisResult | null)[]> {
  const hasPrinciples = principles.length > 0;
  const principleList = hasPrinciples
    ? principles.map(p => `• ${p.title}`).join('\n')
    : null;

  const results: (AnalysisResult | null)[] = new Array(entities.length).fill(null);
  const chunks: EntityRow[][] = [];
  for (let i = 0; i < entities.length; i += CONCURRENCY) {
    chunks.push(entities.slice(i, i + CONCURRENCY));
  }

  let idx = 0;
  for (const chunk of chunks) {
    const settled = await Promise.allSettled(
      chunk.map(async (entity) => {
        const synopsis = entity.synopsis.slice(0, 800);

        const contextBlock = hasPrinciples
          ? `Key principles:\n${principleList}`
          : topic.description
            ? `Description: ${topic.description}`
            : '';

        const prompt =
`You are assessing Scottish legislation for relevance to a subject area.

Subject area: ${topic.name}
${contextBlock}

Item: ${synopsis}

Rate relevance 1–10:
1–3 = minimal or no relevance
4–6 = moderate or indirect relevance
7–8 = significant relevance
9–10 = directly addresses this subject area

Reply ONLY with valid JSON: {"score": N, "rationale": "one sentence, max 100 chars"}`;

        const msg = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 120,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = (msg.content[0] as { type: string; text: string }).text.trim();
        let score = 5;
        let rationale = '';
        try {
          const jsonPart = text.match(/\{[\s\S]*?\}/)?.[0] ?? text;
          const parsed = JSON.parse(jsonPart);
          score    = Math.max(1, Math.min(10, Math.round(Number(parsed.score) || 5)));
          rationale = String(parsed.rationale ?? '').slice(0, 120);
        } catch {
          const m = text.match(/\d+/);
          score = m ? Math.max(1, Math.min(10, parseInt(m[0], 10))) : 5;
          rationale = text.slice(0, 120);
        }

        return {
          entity_type:   entity.entity_type,
          entity_id:     entity.entity_id,
          score,
          rationale,
          synopsis_used: synopsis,
          input_tokens:  msg.usage.input_tokens,
          output_tokens: msg.usage.output_tokens,
        };
      })
    );

    for (const res of settled) {
      results[idx++] = res.status === 'fulfilled' ? res.value : null;
    }
  }
  return results;
}
