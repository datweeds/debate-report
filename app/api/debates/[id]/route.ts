import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

const ALLOWED_TIERS = new Set(['moderator', 'sysadmin']);

const VALID_SUBJECTS = new Set([
  'culture', 'economics', 'education', 'environment', 'future',
  'health', 'history', 'law', 'media', 'philosophy', 'politics', 'science',
]);

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

type Params = { params: Promise<{ id: string }> };

async function getDebate(id: string) {
  const { rows } = await pool.query(
    `SELECT s.id, s.stat_title, s.stat_description, s.subject_area,
            s.forum_visibility, s.image_path, s.created_at, s.created_by,
            u.user_handle AS creator_handle,
            COUNT(c.id)::int AS child_count
     FROM   statements s
     LEFT   JOIN users u ON u.id = s.created_by
     LEFT   JOIN statements c ON c.resolution_id = s.id
     WHERE  s.id = $1 AND s.stat_type = 'resolution'
     GROUP  BY s.id, u.user_handle`,
    [id]
  );
  return rows[0] ?? null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!ALLOWED_TIERS.has(session.tier)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const debate = await getDebate(id);
  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(debate);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!ALLOWED_TIERS.has(session.tier)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const debate = await getDebate(id);
  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (debate.created_by !== session.sub && !session.isSysAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const contentType = req.headers.get('content-type') ?? '';

  // Multipart: image replacement only
  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

    const ext = ALLOWED_IMAGE_TYPES[file.type];
    if (!ext) return NextResponse.json({ error: 'JPEG, PNG or WebP only' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Max 5 MB' }, { status: 400 });

    const filename   = `${id}.${ext}`;
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'debates');
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, filename), Buffer.from(await file.arrayBuffer()));

    const imagePath = `/uploads/debates/${filename}`;
    await pool.query('UPDATE statements SET image_path = $1 WHERE id = $2', [imagePath, id]);
    return NextResponse.json({ imagePath });
  }

  // JSON: update fields
  const body = await req.json();
  const { title, description, subjectArea, removeImage } = body;

  if (title !== undefined) {
    if (!title.trim()) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    if (title.trim().length > 500) return NextResponse.json({ error: 'Title too long' }, { status: 400 });
  }
  if (subjectArea !== undefined && !VALID_SUBJECTS.has(subjectArea)) {
    return NextResponse.json({ error: 'Invalid subject area' }, { status: 400 });
  }

  await pool.query(
    `UPDATE statements
     SET stat_title       = COALESCE($1, stat_title),
         stat_description = CASE WHEN $2::boolean THEN $3 ELSE COALESCE($4, stat_description) END,
         subject_area     = COALESCE($5, subject_area),
         image_path       = CASE WHEN $6::boolean THEN NULL ELSE image_path END
     WHERE id = $7`,
    [
      title?.trim() ?? null,
      description !== undefined,
      description?.trim() || null,
      description?.trim() ?? null,
      subjectArea ?? null,
      removeImage === true,
      id,
    ]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  if (!ALLOWED_TIERS.has(session.tier)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const debate = await getDebate(id);
  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (debate.created_by !== session.sub && !session.isSysAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (debate.child_count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: this resolution has ${debate.child_count} statement${debate.child_count > 1 ? 's' : ''} attached to it.` },
      { status: 409 }
    );
  }

  await pool.query('DELETE FROM statements WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}
