import { NextResponse } from 'next/server';
import { tq } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const topicsRes = await tq(
      `SELECT id, name, description, sort_order FROM nsp_topics ORDER BY sort_order, name`
    );
    const topics = topicsRes.rows;

    if (topics.length === 0) return NextResponse.json({ topics: [] });

    const topicIds = topics.map(t => t.id);

    const setsRes = await tq(
      `SELECT id, topic_id, version, description, is_current, created_at
       FROM nsp_principle_sets
       WHERE topic_id = ANY($1)
       ORDER BY topic_id, version DESC`,
      [topicIds]
    );

    const currentSetByTopic: Record<number, (typeof setsRes.rows)[0]> = {};
    const allSetsByTopic: Record<number, typeof setsRes.rows> = {};
    for (const s of setsRes.rows) {
      (allSetsByTopic[s.topic_id] ??= []).push(s);
      if (s.is_current && !currentSetByTopic[s.topic_id]) currentSetByTopic[s.topic_id] = s;
    }
    for (const t of topics) {
      if (!currentSetByTopic[t.id] && allSetsByTopic[t.id]?.[0]) {
        currentSetByTopic[t.id] = allSetsByTopic[t.id][0];
      }
    }

    const currentSetIds = Object.values(currentSetByTopic).map(s => s.id);

    if (currentSetIds.length === 0) {
      return NextResponse.json({ topics: topics.map(t => ({ ...t, current_set: null, all_sets: [] })) });
    }

    const principlesRes = await tq(
      `SELECT id, set_id, sort_order, title, body, grounding, pvc_poll_id
       FROM nsp_principles
       WHERE set_id = ANY($1)
       ORDER BY set_id, sort_order, id`,
      [currentSetIds]
    );

    const principleIds = principlesRes.rows.map(p => p.id);

    type ReviewRow = { id: number; principle_id: number; user_id: string; user_handle: string; request_text: string; status: string; created_at: string };
    type DebateRow = { principle_id: number; resolution_id: string; stat_title: string; stat_status: string; vote_total_for: number; vote_total_against: number };
    type DrRow = { id: number; principle_id: number; requester_id: string; requester_handle: string; reason: string; status: string; created_at: string };

    let reviews: ReviewRow[] = [];
    let debates: DebateRow[] = [];
    let debateRequests: DrRow[] = [];

    if (principleIds.length > 0) {
      const [rRes, dRes, drRes] = await Promise.all([
        tq<ReviewRow>(
          `SELECT id, principle_id, user_id, user_handle, request_text, status, created_at
           FROM nsp_review_requests
           WHERE principle_id = ANY($1)
           ORDER BY created_at ASC`,
          [principleIds]
        ),
        tq<DebateRow>(
          `SELECT pd.principle_id, s.id AS resolution_id, s.stat_title, s.stat_status,
                  s.vote_total_for, s.vote_total_against
           FROM nsp_principle_debates pd
           JOIN statements s ON s.id = pd.resolution_id
           WHERE pd.principle_id = ANY($1)
           ORDER BY pd.created_at ASC`,
          [principleIds]
        ),
        tq<DrRow>(
          `SELECT r.id, r.entity_id AS principle_id, r.requester_id, r.requester_handle,
                  r.reason, r.status, r.created_at
           FROM sp_debate_requests r
           WHERE r.entity_type = 'principle' AND r.entity_id = ANY($1)
           ORDER BY r.created_at DESC`,
          [principleIds]
        ),
      ]);
      reviews = rRes.rows;
      debates = dRes.rows;
      debateRequests = drRes.rows;
    }

    // Fetch live poll data for principles with pvc_poll_id
    type PollData = { poll_id: string; title: string; status: string; vote_count: number; result_visibility: string };
    const principlesWithPoll = principlesRes.rows.filter(p => p.pvc_poll_id);
    const pollByPrinciple: Record<number, PollData | null> = {};
    if (principlesWithPoll.length > 0) {
      const results = await Promise.allSettled(
        principlesWithPoll.map(async p => {
          try {
            const r = await fetch(`https://poll.voter.care/api/v1/voter/polls/${p.pvc_poll_id}`, { next: { revalidate: 60 } });
            if (!r.ok) return { id: p.id as number, poll: null };
            const d = await r.json();
            return { id: p.id as number, poll: { poll_id: p.pvc_poll_id as string, title: d.title, status: d.status, vote_count: d.vote_count, result_visibility: d.result_visibility } };
          } catch { return { id: p.id as number, poll: null }; }
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') pollByPrinciple[r.value.id] = r.value.poll;
      }
    }

    const reviewsByPrinciple: Record<number, ReviewRow[]> = {};
    for (const r of reviews) (reviewsByPrinciple[r.principle_id] ??= []).push(r);

    const debatesByPrinciple: Record<number, DebateRow[]> = {};
    for (const d of debates) (debatesByPrinciple[d.principle_id] ??= []).push(d);

    const drByPrinciple: Record<number, DrRow[]> = {};
    for (const r of debateRequests) (drByPrinciple[r.principle_id] ??= []).push(r);

    const principlesBySet: Record<number, object[]> = {};
    for (const p of principlesRes.rows) {
      (principlesBySet[p.set_id] ??= []).push({
        ...p,
        review_requests: reviewsByPrinciple[p.id] ?? [],
        debates: debatesByPrinciple[p.id] ?? [],
        debate_requests: drByPrinciple[p.id] ?? [],
        poll: pollByPrinciple[p.id] ?? null,
      });
    }

    const result = topics.map(t => {
      const cur = currentSetByTopic[t.id] ?? null;
      return {
        ...t,
        current_set: cur ? { ...cur, principles: principlesBySet[cur.id] ?? [] } : null,
        all_sets: allSetsByTopic[t.id] ?? [],
      };
    });

    return NextResponse.json({ topics: result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
