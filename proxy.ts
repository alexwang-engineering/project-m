import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { isProtectedPath, safeNextPath } from '@/lib/auth/redirects';

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Builds a per-request nonce-based CSP. `strict-dynamic` plus a nonce lets
 * Next's own framework/page scripts run (Next attaches the nonce to them
 * automatically once it sees `'nonce-...'` in this header) while blocking
 * everything else - no `unsafe-inline` in production. `'unsafe-eval'` is
 * dev-only, required by React's dev-mode error-stack reconstruction, per
 * Next's own CSP guide (node_modules/next/dist/docs/01-app/02-guides/
 * content-security-policy.md).
 */
function buildCspHeader(nonce: string, supabaseOrigin: string | null): string {
  const connectSrc = ["'self'", supabaseOrigin].filter(Boolean).join(' ');
  const imgSrc = ["'self'", 'blob:', 'data:', supabaseOrigin]
    .filter(Boolean)
    .join(' ');
  const frameSrc = ["'self'", supabaseOrigin].filter(Boolean).join(' ');
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${IS_DEV ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${IS_DEV ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    `img-src ${imgSrc}`,
    `font-src 'self'`,
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];
  if (!IS_DEV) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/** Every response this proxy returns gets the same CSP + no-store caching - nothing here is safe to cache across users. */
function withSecurityHeaders(
  response: NextResponse,
  csp: string,
): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'private, no-store');
  if (!IS_DEV) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
  }
  return response;
}

/**
 * Dev-only login bridges (temporary, never committed - see .gitignore)
 * must be unreachable in production. `notFound()` inside the page itself
 * renders the right content but doesn't reliably flip the HTTP status to
 * 404 in this Next version even with `dynamic = 'force-dynamic'` (verified
 * live: `next start` + curl returned "200 OK" with 404 body content) - a
 * real response built here is unambiguous regardless of that App Router
 * nuance.
 */
function isDevOnlyLoginBridge(pathname: string): boolean {
  return pathname === '/dev-login' || pathname.startsWith('/dev-login/');
}

function isDemoLogin(pathname: string): boolean {
  return pathname === '/demo' || pathname.startsWith('/demo/');
}

/** Refreshes Supabase auth cookies; authorization remains in RLS/server code. */
export async function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV === 'production' &&
    isDevOnlyLoginBridge(request.nextUrl.pathname)
  ) {
    return new NextResponse(null, { status: 404 });
  }
  if (
    isDemoLogin(request.nextUrl.pathname) &&
    process.env.DEMO_MODE !== 'true'
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const supabaseOrigin = url ? new URL(url).origin : null;
  const csp = buildCspHeader(nonce, supabaseOrigin);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!url || !publishableKey) {
    if (!isProtectedPath(request.nextUrl.pathname))
      return withSecurityHeaders(response, csp);
    const error = request.nextUrl.clone();
    error.pathname = '/auth/error';
    error.search = '?code=configuration';
    return withSecurityHeaders(NextResponse.redirect(error), csp);
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (isProtectedPath(request.nextUrl.pathname) && !data?.claims?.sub) {
    const login = request.nextUrl.clone();
    login.pathname = '/auth/login';
    login.search = '';
    login.searchParams.set(
      'next',
      safeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );
    return withSecurityHeaders(NextResponse.redirect(login), csp);
  }
  return withSecurityHeaders(response, csp);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
