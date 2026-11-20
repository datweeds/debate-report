import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { DEFAULT_SETTINGS, NewsError, editionTitle, loadSettings, syncSubscription } from '@/lib/news';
import { checkSettings } from '@/lib/newsSettings';

async function moderatorOnly(req: NextRequest, rawId: string) {
  const a = await societyContentAccess(req, rawId);
  if (!a) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (!a.canModerate) return { error: NextResponse.json({ error: 'Only this Society’s moderators can change its News' }, { status: 403 }) };
  return { a };
}

async function societyName(id: number) {
  return (await pool.query('SELECT name FROM customers WHERE id = $1', [id])).rows[0]?.name ?? '';
}

// GET — the News settings, for the settings page (moderators)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { a, error } = await moderatorOnly(req, (await params).id);
  if (error) return error;
  const name = await societyName(a.societyId);
  const settings = await loadSettings(a.societyId) ?? { ...DEFAULT_SETTINGS, sections: [], subscription_id: null };
  return NextResponse.json({ societyName: name, defaultTitle: editionTitle(name, { title: null, cadence: settings.cadence }), settings });
}

// PUT — save the settings, then update the Society's subscription in News
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { a, error } = await moderatorOnly(req, (await params).id);
  if (error) return error;
  const checked = checkSettings(await req.json().catch(() => null));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const s = checked.value;
  const userId = a.session!.sub;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO society_news (customer_id, enabled, title, cadence, publish_time, publish_weekday, locations, min_score, max_items, updated_by, include_papers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (customer_id) DO UPDATE SET enabled = $2, title = $3, cadence = $4, publish_time = $5,
         publish_weekday = $6, locations = $7, min_score = $8, max_items = $9, updated_by = $10, include_papers = $11, updated_at = now()`,
      [a.societyId, s.enabled, s.title, s.cadence, s.publish_time, s.publish_weekday, JSON.stringify(s.locations),
       s.min_score, s.max_items, userId, s.include_papers]);
    await client.query('DELETE FROM society_news_sections WHERE customer_id = $1 AND NOT (id = ANY($2::uuid[]))',
      [a.societyId, s.sections.map(x => x.id)]);
    for (const sec of s.sections) {
      await client.query(
        `INSERT INTO society_news_sections (id, customer_id, heading, phrases, must_include, must_exclude, sort_order, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET heading = $3, phrases = $4, must_include = $5, must_exclude = $6, sort_order = $7, updated_at = now()
         WHERE society_news_sections.customer_id = $2`,
        [sec.id, a.societyId, sec.heading, sec.phrases, sec.must_include, sec.must_exclude, sec.sort_order, userId]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  let warning: string | null = null;
  try {
    await syncSubscription(a.societyId, await societyName(a.societyId));
  } catch (err) {
    warning = err instanceof NewsError ? `Saved, but the News service said: ${err.message}` : 'Saved, but the News service could not be updated';
    console.error('[news] sync', err);
  }
  return NextResponse.json({ settings: await loadSettings(a.societyId), warning });
}
