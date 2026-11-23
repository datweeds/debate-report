import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { isSocietyModerator } from '@/lib/roles';
import { saveSocietyImage, clearSocietyImage } from '@/lib/societyImage';

// Society dashboard image, for the Society's moderators.

type Params = { params: Promise<{ id: string }> };

async function moderatedId(req: NextRequest, params: Params['params']): Promise<number | null> {
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return null;
  return await isSocietyModerator(await getSessionFromRequest(req), id) ? id : null;
}

export async function POST(req: NextRequest, { params }: Params) {
  const id = await moderatedId(req, params);
  if (id == null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const result = await saveSocietyImage(id, (await req.formData()).get('image') as File | null, (await getSessionFromRequest(req))?.sub ?? null);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ imagePath: result.imagePath });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const id = await moderatedId(req, params);
  if (id == null || !await clearSocietyImage(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
