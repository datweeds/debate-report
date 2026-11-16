import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { societyContentAccess } from '@/lib/societies';
import { sealText } from '@/lib/societyCrypto';
import { lockSafe } from '@/lib/lockSafe';

type Params = { params: Promise<{ id: string; folderId: string }> };

async function ctx(req: NextRequest, params: Params['params']) {
  const { id, folderId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !/^[0-9a-f-]{36}$/i.test(folderId)) return null;
  const { rows } = await pool.query('SELECT id FROM document_folders WHERE id = $1 AND customer_id = $2', [folderId, a.societyId]);
  return rows.length ? { a, folderId } : null;
}

// PATCH { name } — rename (moderators).
async function handlePATCH(req: NextRequest, { params }: Params) {
  const c = await ctx(req, params);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { name } = await req.json().catch(() => ({}));
  if (typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
  await pool.query('UPDATE document_folders SET name = $1 WHERE id = $2', [await sealText(c.a.societyId, name.trim().slice(0, 120)), c.folderId]);
  return NextResponse.json({ ok: true });
}

// DELETE — moderators; only an empty folder, so nothing is lost by accident.
async function handleDELETE(req: NextRequest, { params }: Params) {
  const c = await ctx(req, params);
  if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!c.a.canModerate) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { rows: [n] } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM documents WHERE folder_id = $1 AND deleted_at IS NULL)
          + (SELECT COUNT(*) FROM document_folders WHERE parent_id = $1) AS n`, [c.folderId]);
  if (Number(n.n) > 0) return NextResponse.json({ error: 'Move or delete what is in this folder first' }, { status: 409 });
  await pool.query('DELETE FROM document_folders WHERE id = $1', [c.folderId]);
  return NextResponse.json({ ok: true });
}

export const PATCH = lockSafe(handlePATCH);
export const DELETE = lockSafe(handleDELETE);
