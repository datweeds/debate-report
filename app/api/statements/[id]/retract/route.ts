import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getStatementForOwnershipCheck, retractStatementCascade } from '@/lib/statements';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { id } = await params;

  const stmt = await getStatementForOwnershipCheck(id);
  if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (stmt.created_by !== session.sub && !session.isSysAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const retracted = await retractStatementCascade(id);
  return NextResponse.json({ retracted });
}
