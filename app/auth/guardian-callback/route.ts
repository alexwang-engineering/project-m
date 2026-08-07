import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';

/**
 * Exchanges a guardian magic-link's one-use PKCE code. No separate
 * admission re-check here, unlike /auth/callback's institutional path -
 * the provision_admitted_guardian trigger already enforced admission
 * atomically at auth.users insert time (SECURITY DEFINER, fail-closed);
 * a profiles row with kind = 'guardian' cannot exist otherwise.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code || code.length > 2048) {
    return NextResponse.redirect(new URL('/parent/login?error=invalid_callback', url.origin));
  }

  const client = await createServerClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/parent/login?error=invalid_callback', url.origin));
  }
  return NextResponse.redirect(new URL('/parent', url.origin), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
