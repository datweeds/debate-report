import { NextRequest, NextResponse } from 'next/server';
import { screenImageUpload } from '@/lib/imageScan';
import { writeFile, mkdir } from 'fs/promises';
import crypto from 'crypto';
import path from 'path';
import { getSessionFromRequest } from '@/lib/auth';

// POST (multipart "image") — a topic image. Served publicly, as emails link to it.
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const dir = path.join(process.cwd(), 'public', 'uploads', 'newsletter');

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const file = (await req.formData().catch(() => null))?.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Image must be JPEG, PNG, WebP or GIF' }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 400 });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const screen = await screenImageUpload({ bytes, mime: file.type, fileName: file.name, userId: session.sub, societyId: null, where: 'newsletter image' });
  if (!screen.ok) return NextResponse.json({ error: screen.error }, { status: 422 });
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return NextResponse.json({ imagePath: `/uploads/newsletter/${name}` });
}
