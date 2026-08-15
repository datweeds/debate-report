import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const PLATFORM_DOMAINS = (process.env.PLATFORM_DOMAINS ?? 'localhost').split(',').map(d => d.trim().toLowerCase());

function parseSubdomain(host: string): string | null {
  const h = host.split(':')[0].toLowerCase();
  for (const domain of PLATFORM_DOMAINS) {
    if (h === domain) return null;
    if (h.endsWith('.' + domain)) {
      return h.slice(0, -(domain.length + 1));
    }
  }
  return null;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('dr_session')?.value;

  // ── Auth guards ──────────────────────────────────────────────────────────────
  const TENANT_ID = process.env.TENANT_ID ? parseInt(process.env.TENANT_ID, 10) : null;

  if (pathname.startsWith('/admin') || pathname.startsWith('/scotparl/admin')) {
    if (!token) return NextResponse.redirect(new URL('/login?next=' + pathname, req.url));
    const session = await verifyToken(token);
    if (!session) return NextResponse.redirect(new URL('/login?next=' + pathname, req.url));
    const isSysAdmin = session.isSysAdmin;
    const isCustomerAdmin = TENANT_ID !== null && (session.customerAdminTenants ?? []).includes(TENANT_ID);
    const isTopicOwner    = TENANT_ID !== null && (session.topicOwnerTenants    ?? []).includes(TENANT_ID);
    // /admin (platform dashboard) → SysAdmin only
    // /scotparl/admin (customer panel) → SysAdmin, CustomerAdmin, or TopicOwner for this tenant
    if (pathname.startsWith('/admin') && !isSysAdmin) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (pathname.startsWith('/scotparl/admin') && !isSysAdmin && !isCustomerAdmin && !isTopicOwner) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  if (pathname.startsWith('/api/admin')) {
    if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    const session = await verifyToken(token);
    if (!session?.isSysAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Subdomain detection ──────────────────────────────────────────────────────
  const host = req.headers.get('host') ?? '';
  const subdomain = parseSubdomain(host);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-customer-subdomain', subdomain ?? '');

  // Rewrite customer subdomain paths to /scotparl/* prefix
  if (subdomain) {
    if (
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/_next') &&
      !pathname.startsWith('/scotparl') &&
      !pathname.startsWith('/chamber') &&
      !pathname.startsWith('/login') &&
      !pathname.startsWith('/register') &&
      !pathname.startsWith('/pricing') &&
      !pathname.startsWith('/profile') &&
      !pathname.startsWith('/dashboard') &&
      !pathname.startsWith('/admin') &&
      !pathname.startsWith('/sso')
    ) {
      const url = req.nextUrl.clone();
      url.pathname = pathname === '/' ? '/scotparl' : `/scotparl${pathname}`;
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.ico).*)'],
};
