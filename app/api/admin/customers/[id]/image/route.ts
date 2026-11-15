import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { saveSocietyImage, clearSocietyImage } from '@/lib/societyImage';

// Society dashboard image (customers.hero_image). SysAdmin only.

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Society not found' }, { status: 404 });

  const result = await saveSocietyImage(id, (await req.formData()).get('image') as File | null);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ imagePath: result.imagePath });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSessionFromRequest(req);
  if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const id = parseInt((await params).id, 10);
  if (isNaN(id) || !await clearSocietyImage(id)) return NextResponse.json({ error: 'Society not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
