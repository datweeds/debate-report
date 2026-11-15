import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';

type Params = { params: Promise<{ id: string }> };

// GET — every folder in the Society (for "move to folder" pickers), as a flat list.
export async function GET(req: NextRequest, { params }: Params) {
  const a = await societyContentAccess(req, (await params).id);
  if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows } = await pool.query(
    `WITH RECURSIVE t AS (
       SELECT id, parent_id, name, name::text AS full_path FROM document_folders WHERE customer_id = $1 AND parent_id IS NULL
       UNION ALL SELECT f.id, f.parent_id, f.name, t.full_path || ' / ' || f.name FROM document_folders f JOIN t ON f.parent_id = t.id)
     SELECT id, full_path FROM t ORDER BY full_path`, [a.societyId]);
  return NextResponse.json({ folders: rows });
}

// POST { name, parentId? } — moderators build the folder structure.
export async function POST(req: NextRequest, { params }: Params) {
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
    [a.societyId, parent, name.trim().slice(0, 120), a.session!.sub],
  );
  return NextResponse.json({ id: f.id }, { status: 201 });
}
