import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { NewsError, definition, newsFetch, schedule } from '@/lib/news';
import { checkSettings } from '@/lib/newsSettings';

// POST { settings as on the form } — test unsaved settings: what an edition
// would contain now, with scores and reasons, and guidance on each search
// phrase. Nothing is saved and no LLM is used. Moderators.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Moderators only' }, { status: 403 });
  const checked = checkSettings(await req.json().catch(() => null));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  if (!checked.value.sections.length) return NextResponse.json({ error: 'Add a section with some search phrases first' }, { status: 400 });
  const { rows: [society] } = await pool.query('SELECT name FROM customers WHERE id = $1', [a.societyId]);
  try {
    const preview = await newsFetch('/v1/subscriptions/preview', {
      method: 'POST',
      body: { definition: definition(society?.name ?? '', checked.value), schedule: schedule(checked.value) },
    });
    return NextResponse.json({ preview, sectionIds: checked.value.sections.map(s => s.id) });
  } catch (err) {
    if (err instanceof NewsError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
