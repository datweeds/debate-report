import { NextRequest, NextResponse } from 'next/server';
import { screenImageUpload } from '@/lib/imageScan';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';
import { isSocietyModerator } from '@/lib/roles';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  // Only a moderator of the debate's Society may change its image
  const debate = await pool.query(
    `SELECT id, created_by, customer_id FROM statements WHERE id = $1 AND stat_type = 'resolution'`,
    [id]
  );
  if (!debate.rows.length) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 });
  }
  if (!await isSocietyModerator(session, debate.rows[0].customer_id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Image must be JPEG, PNG or WebP' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 400 });
  }

  const filename   = `${id}.${ext}`;
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'debates');
  const filePath   = path.join(uploadsDir, filename);

  const bytes = Buffer.from(await file.arrayBuffer());
  const screen = await screenImageUpload({ bytes, mime: file.type, fileName: file.name, userId: session.sub,
    societyId: debate.rows[0].customer_id ?? null, where: 'debate image' });
  if (!screen.ok) return NextResponse.json({ error: screen.error }, { status: 422 });
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(filePath, bytes);

  const imagePath = `/uploads/debates/${filename}`;
  await pool.query(
    `UPDATE statements SET image_path = $1 WHERE id = $2`,
    [imagePath, id]
  );

  return NextResponse.json({ imagePath });
}
