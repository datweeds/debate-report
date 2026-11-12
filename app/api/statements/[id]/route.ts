import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStatementForOwnershipCheck, updateStatementText } from '@/lib/statements';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const stmt = await getStatementForOwnershipCheck(id);
  if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (stmt.created_by !== session.sub && !session.isSysAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const newDescription = body.description != null ? body.description.toString().trim() : null;

  const resolutionId: string = stmt.resolution_id ?? id;
  const result = await updateStatementText(id, (body.title ?? '').toString().trim(), newDescription, resolutionId, session.sub);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.data);
}
