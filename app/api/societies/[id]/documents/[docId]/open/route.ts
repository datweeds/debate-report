import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { openText } from '@/lib/societyCrypto';
import { societyContentAccess } from '@/lib/societies';

type Params = { params: Promise<{ id: string; docId: string }> };

// GET — follow a link item, counting the open. Relative Location so it works behind nginx.
export async function GET(req: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  const a = await societyContentAccess(req, id);
  if (!a || !/^[0-9a-f-]{36}$/i.test(docId)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { rows: [d] } = await pool.query(
    `UPDATE documents SET open_count = open_count + 1
     WHERE id = $1 AND customer_id = $2 AND kind = 'link' AND deleted_at IS NULL RETURNING url`,
    [docId, a.societyId],
  );
  if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const url = await openText(a.societyId, d.url as string);
  return new NextResponse(null, { status: 302, headers: { Location: url, 'Referrer-Policy': 'no-referrer' } });
}
