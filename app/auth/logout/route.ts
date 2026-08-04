import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';

/** Revokes the current browser session. POST avoids cross-site logout links. */
export async function POST(request: Request) {
  const client = await createServerClient();
  await client.auth.signOut({ scope: 'local' });
  return NextResponse.redirect(new URL('/', request.url), {
    status: 303,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
