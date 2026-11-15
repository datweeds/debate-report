import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { ensureCurrentVersion, readPrinciple } from '@/lib/principles';

type Params = { params: Promise<{ id: string }> };

// GET ?version=N — the Society's principles (default: current version), the
// version history, and for each principle its discussion, debate and reviews.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows: versions } = await pool.query(
    `SELECT v.id, v.version, v.change_note, v.is_current, v.created_at, u.user_handle AS created_by
     FROM society_principle_versions v LEFT JOIN users u ON u.id = v.created_by
     WHERE v.customer_id = $1 ORDER BY v.version DESC`, [a.societyId]);
  const wanted = Number(req.nextUrl.searchParams.get('version'));
  const version = versions.find(v => wanted ? v.version === wanted : v.is_current) ?? null;

  const { rows: principles } = version ? await pool.query(
    `SELECT p.id, p.lineage_id, p.sort_order, p.category, p.title, p.body, p.grounding,
            l.thread_id, l.resolution_id,
            r.vote_total_for, r.vote_total_against,
            (SELECT COUNT(*)::int FROM discussion_posts dp WHERE dp.thread_id = l.thread_id AND dp.deleted_at IS NULL) AS post_count,
            COALESCE((SELECT json_agg(json_build_object('id', rv.id, 'text', rv.request_text, 'status', rv.status,
                                                        'by', ru.user_handle, 'created_at', rv.created_at) ORDER BY rv.created_at DESC)
                      FROM society_principle_reviews rv LEFT JOIN users ru ON ru.id = rv.user_id
                      WHERE rv.lineage_id = p.lineage_id AND rv.status <> 'resolved'), '[]') AS reviews
     FROM society_principles p
     LEFT JOIN society_principle_links l ON l.lineage_id = p.lineage_id
     LEFT JOIN statements r ON r.id = l.resolution_id AND r.stat_status <> 'deleted'
     WHERE p.version_id = $1
     ORDER BY p.sort_order, p.created_at`, [version.id]) : { rows: [] };

  return NextResponse.json({
    version, versions, principles,
    canPost: a.canPost, canModerate: a.canModerate,
  });
}

// POST { category, title, body, grounding? } — moderators add a principle to the current version.
export async function POST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Only moderators can change the principles' }, { status: 403 });
  const p = readPrinciple(await req.json().catch(() => ({})));
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
  const v = await ensureCurrentVersion(a.societyId, a.session!.sub);
  const { rows: [row] } = await pool.query(
    `INSERT INTO society_principles (version_id, sort_order, category, title, body, grounding)
     VALUES ($1, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM society_principles WHERE version_id = $1), $2, $3, $4, $5)
     RETURNING id`,
    [v.id, p.category, p.title, p.body, p.grounding],
  );
  return NextResponse.json({ id: row.id }, { status: 201 });
}
