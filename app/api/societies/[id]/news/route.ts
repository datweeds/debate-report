import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { DEFAULT_SETTINGS, editionTitle, loadSettings, newsConfigured, pullEditions, reportRead } from '@/lib/news';

// GET ?edition=<id> — the Society's News: its title, the list of editions,
// and one edition in full (the latest unless asked for).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows: [society] } = await pool.query('SELECT name FROM customers WHERE id = $1', [a.societyId]);
  const settings = await loadSettings(a.societyId);

  if (settings?.subscription_id) {
    await pullEditions(a.societyId).catch(err => console.error('[news] pull', err));
    void reportRead(a.societyId);
  }

  const { rows: editions } = await pool.query(
    `SELECT id, edition_date::text AS edition_date, cadence, item_count, created_at FROM society_news_editions
     WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 60`, [a.societyId]);
  const wanted = req.nextUrl.searchParams.get('edition');
  const pick = editions.find(e => e.id === wanted) ?? editions[0];
  const edition = pick
    ? (await pool.query('SELECT id, edition_date::text AS edition_date, cadence, overview, items, created_at FROM society_news_editions WHERE id = $1', [pick.id])).rows[0]
    : null;

  const s = settings ?? { ...DEFAULT_SETTINGS, sections: [], subscription_id: null };
  return NextResponse.json({
    society: { id: a.societyId, name: society?.name ?? '' },
    title: editionTitle(society?.name ?? '', edition ? { title: s.title, cadence: edition.cadence } : s),
    cadence: s.cadence,
    publishTime: s.publish_time,
    publishWeekday: s.publish_weekday,
    available: newsConfigured(),
    configured: !!settings && settings.sections.length > 0,
    enabled: s.enabled,
    editions,
    edition,
    canModerate: a.canModerate,
    canPost: a.canPost,
  });
}
