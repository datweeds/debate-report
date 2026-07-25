import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('dr_session')?.value;

  if (pathname.startsWith('/admin')) {
    if (!token) return NextResponse.redirect(new URL('/login?next=/admin', req.url));
    const session = await verifyToken(token);
    if (!session?.isSysAdmin) return NextResponse.redirect(new URL('/', req.url));
  }

  if (pathname.startsWith('/api/admin')) {
    if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const session = await verifyToken(token);
    if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
