import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { isProtectedPath, safeNextPath } from '@/lib/auth/redirects';

/** Refreshes Supabase auth cookies; authorization remains in RLS/server code. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    if (!isProtectedPath(request.nextUrl.pathname)) return response;
    const error = request.nextUrl.clone();
    error.pathname = '/auth/error';
    error.search = '?code=configuration';
    return NextResponse.redirect(error, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        response = NextResponse.next({ request });
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
    return NextResponse.redirect(login, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
