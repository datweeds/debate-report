import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { NewsError, loadSettings, newsFetch } from '@/lib/news';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Ctx = { params: Promise<{ id: string; clusterId: string }> };

function newsError(err: unknown) {
  if (err instanceof NewsError) return NextResponse.json({ error: err.message }, { status: err.status });
  throw err;
}

// GET — all coverage of a story (every outlet that carried it)
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id, clusterId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !UUID.test(clusterId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    return NextResponse.json(await newsFetch(`/v1/clusters/${clusterId}`));
  } catch (err) {
    return newsError(err);
  }
}

// POST { action: 'hide' | 'headline' } (moderators), or
//      { action: 'feedback', value: 'useful' | 'not_relevant' | 'seen_elsewhere' } (members)
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id, clusterId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !UUID.test(clusterId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const settings = await loadSettings(a.societyId);
  if (!settings?.subscription_id) return NextResponse.json({ error: 'This Society has no News yet' }, { status: 400 });
  const { action, value } = await req.json().catch(() => ({}));

  try {
    if (action === 'feedback') {
      if (!a.canPost) return NextResponse.json({ error: 'Sign in as a member to give feedback' }, { status: 403 });
      if (!['useful', 'not_relevant', 'seen_elsewhere'].includes(value)) return NextResponse.json({ error: 'Unknown feedback' }, { status: 400 });
      await newsFetch('/v1/feedback', { method: 'POST', body: { subscription_id: settings.subscription_id, cluster_id: clusterId, value } });
      return NextResponse.json({ ok: true });
    }
    if (action !== 'hide' && action !== 'headline') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    if (!a.canModerate) return NextResponse.json({ error: 'Society Admins only' }, { status: 403 });
    await newsFetch(`/v1/subscriptions/${settings.subscription_id}/overrides`, {
      method: 'POST', body: { cluster_id: clusterId, action },
    });

    // Apply it to the latest edition straight away, too
    const { rows: [edition] } = await pool.query(
      `SELECT id, items FROM society_news_editions WHERE customer_id = $1 AND items @> $2::jsonb
       ORDER BY created_at DESC LIMIT 1`, [a.societyId, JSON.stringify([{ cluster_id: clusterId }])]);
    if (edition) {
      let items = edition.items as { cluster_id: string; is_headline?: boolean }[];
      if (action === 'hide') {
        const wasHeadline = items.find(i => i.cluster_id === clusterId)?.is_headline;
        items = items.filter(i => i.cluster_id !== clusterId);
        if (wasHeadline && items.length) items[0] = { ...items[0], is_headline: true };
      } else {
        const chosen = items.find(i => i.cluster_id === clusterId)!;
        items = [{ ...chosen, is_headline: true }, ...items.filter(i => i.cluster_id !== clusterId).map(i => ({ ...i, is_headline: false }))];
      }
      await pool.query('UPDATE society_news_editions SET items = $2, item_count = $3 WHERE id = $1',
        [edition.id, JSON.stringify(items), items.length]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return newsError(err);
  }
}
