import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getPartyFromRequest } from '@/lib/apiParties';

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/resolutions/:id — full dump of a public resolution: the resolution
// itself, every statement under it (each with its stable UUID), and the
// parent/child relationships between them. Lets an external party see the whole
// debate before deciding which statements to engage with.
export async function GET(req: NextRequest, { params }: Params) {
  const party = await getPartyFromRequest(req);
  if (!party) return NextResponse.json({ error: 'Invalid or missing API token' }, { status: 401 });

  const { id } = await params;

  const { rows: resRows } = await pool.query(
    `SELECT s.id, s.stat_title, s.stat_description, s.subject_area, s.created_at,
            s.forum_id, s.forum_visibility,
            u.user_handle AS creator_handle,
            f.forum_type, f.forum_visibility AS forum_vis
     FROM   statements s
     LEFT   JOIN users u ON u.id = s.created_by
     LEFT   JOIN debate_forums f ON f.id = s.forum_id
     WHERE  s.id = $1 AND s.stat_type = 'resolution'`,
    [id],
  );
  const resolution = resRows[0] ?? null;
  if (!resolution) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isPublic = !resolution.forum_id
    ? resolution.forum_visibility === 'public'
    : resolution.forum_type === 'public';
  if (!isPublic) {
    // The external API only ever serves public resolutions — forum membership
    // has no meaning for a third-party token.
    return NextResponse.json({ error: 'This resolution is not public' }, { status: 403 });
  }

  const { rows: statements } = await pool.query(
    `SELECT s.id, s.stat_type, s.stat_title, s.stat_direction, s.stat_description,
            s.created_at, s.created_by, s.retracted_at,
            u.user_handle AS creator_handle
     FROM   statements s
     LEFT   JOIN users u ON u.id = s.created_by
     WHERE  s.resolution_id = $1
     ORDER  BY s.created_at ASC`,
    [id],
  );

  const { rows: relationships } = await pool.query(
    `SELECT sr.stat_id_supported, sr.stat_id_supported_by
     FROM   stat_relationships sr
     WHERE  sr.stat_id_supported = $1
        OR  sr.stat_id_supported_by IN (SELECT id FROM statements WHERE resolution_id = $1)
        OR  sr.stat_id_supported    IN (SELECT id FROM statements WHERE resolution_id = $1)`,
    [id],
  );

  return NextResponse.json({
    resolution: { id: resolution.id, title: resolution.stat_title, description: resolution.stat_description, subject_area: resolution.subject_area, created_at: resolution.created_at, creator_handle: resolution.creator_handle },
    statements,
    relationships,
  });
}
