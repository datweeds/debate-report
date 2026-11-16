import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { type Digest, NewsError, loadSettings, newsFetch, storeEdition, syncSubscription } from '@/lib/news';

// POST — publish an edition now, outside the schedule. Moderators.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Moderators only' }, { status: 403 });
  try {
    let settings = await loadSettings(a.societyId);
    if (!settings?.sections.length) return NextResponse.json({ error: 'Set up the News sections first' }, { status: 400 });
    if (!settings.subscription_id) {
      const { rows: [s] } = await pool.query('SELECT name FROM customers WHERE id = $1', [a.societyId]);
      await syncSubscription(a.societyId, s?.name ?? '');
      settings = await loadSettings(a.societyId);
    }
    // Publishing is reading too: lets News write it up in "auto" mode
    await newsFetch(`/v1/subscriptions/${settings!.subscription_id}/read`, { method: 'POST' });
    const digest = await newsFetch<Digest>(`/v1/subscriptions/${settings!.subscription_id}/digests`, { method: 'POST' });
    await storeEdition(a.societyId, digest);
    const { rows: [row] } = await pool.query('SELECT id FROM society_news_editions WHERE digest_id = $1', [digest.id]);
    return NextResponse.json({ edition: row?.id ?? null, items: digest.items.length });
  } catch (err) {
    if (err instanceof NewsError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
