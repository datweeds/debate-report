import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { sealText } from '@/lib/societyCrypto';
import { folderPaths } from '@/lib/folders';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string }> };

// GET — every folder in the Society (for "move to folder" pickers), as a flat list.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const folders = (await folderPaths([a.societyId])).map(f => ({ id: f.id, full_path: f.full_path }));
  return NextResponse.json({ folders });
}

// POST { name, parentId? } — moderators build the folder structure.
async function handlePOST(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!a.canModerate) return NextResponse.json({ error: 'Only moderators can create folders' }, { status: 403 });
  const { name, parentId } = await req.json().catch(() => ({}));
  if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
  let parent: string | null = null;
  if (typeof parentId === 'string' && /^[0-9a-f-]{36}$/i.test(parentId)) {
    const { rows } = await pool.query('SELECT 1 FROM document_folders WHERE id = $1 AND customer_id = $2', [parentId, a.societyId]);
    if (!rows.length) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    parent = parentId;
  }
  const { rows: [f] } = await pool.query(
    'INSERT INTO document_folders (customer_id, parent_id, name, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
    [a.societyId, parent, await sealText(a.societyId, name.trim().slice(0, 120)), a.session!.sub],
  );
  return NextResponse.json({ id: f.id }, { status: 201 });
}

export const POST = lockSafe(handlePOST);
