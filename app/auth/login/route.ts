import { NextResponse } from 'next/server';

import { getAppOrigin, getInstitutionalAuthConfig } from '@/lib/auth/config';
import { safeNextPath } from '@/lib/auth/redirects';
import { createServerClient } from '@/lib/supabase/server';

/** Starts Microsoft Entra OAuth using Supabase's cookie-backed PKCE flow. */
export async function GET(request: Request) {
  try {
    const config = getInstitutionalAuthConfig();
    const next = safeNextPath(new URL(request.url).searchParams.get('next'));
    const callback = new URL('/auth/callback', config.appOrigin);
    callback.searchParams.set('next', next);
    const client = await createServerClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: callback.toString(),
        scopes: 'email',
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) throw new Error('OAuth initiation failed.');
    return NextResponse.redirect(data.url, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    try {
      return NextResponse.redirect(
        new URL('/auth/error?code=configuration', getAppOrigin()),
      );
    } catch {
      return new NextResponse('Authentication is not configured.', {
        status: 500,
      });
    }
  }
}
