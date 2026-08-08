import { NextResponse } from 'next/server';

import { verifyInstitutionalUser } from '@/lib/auth/admission';
import { getAppOrigin, getInstitutionalAuthConfig } from '@/lib/auth/config';
import { safeNextPath } from '@/lib/auth/redirects';
import { createServerClient } from '@/lib/supabase/server';

function errorRedirect(origin: string, code: string): NextResponse {
  const url = new URL('/auth/error', origin);
  url.searchParams.set('code', code);
  return NextResponse.redirect(url, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

/** Exchanges the one-use PKCE code and independently re-checks institutional admission. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048) {
    try {
      return errorRedirect(getAppOrigin(), 'invalid_callback');
    } catch {
      return new NextResponse('Authentication is not configured.', {
        status: 500,
      });
    }
  }

  try {
    const config = getInstitutionalAuthConfig();
    const client = await createServerClient();
    const exchanged = await client.auth.exchangeCodeForSession(code);
    if (exchanged.error)
      return errorRedirect(config.appOrigin, 'invalid_callback');
    const { data, error } = await client.auth.getUser();
    if (error || !data.user)
      return errorRedirect(config.appOrigin, 'invalid_session');
    const admission = verifyInstitutionalUser(data.user, config);
    if (!admission.ok) {
      await client.auth.signOut({ scope: 'local' });
      return errorRedirect(config.appOrigin, `rejected_${admission.code}`);
    }
    const next = safeNextPath(url.searchParams.get('next'));
    return NextResponse.redirect(new URL(next, config.appOrigin), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    try {
      return errorRedirect(getAppOrigin(), 'configuration');
    } catch {
      return new NextResponse('Authentication is not configured.', {
        status: 500,
      });
    }
  }
}
