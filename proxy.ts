import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

// /api/cron/prices se protege com Bearer (lib/price-watch-secret.ts), não com sessão.
const PUBLIC_PATHS = new Set(['/login', '/api/health', '/api/cron/prices']);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) !== null;

  if (pathname === '/login' && authenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (PUBLIC_PATHS.has(pathname) || authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

// Arquivos do app instalável (manifest, ícones, service worker) são públicos: o celular os busca sem login.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|icon/|apple-icon|sw.js|offline.html).*)',
  ],
};
