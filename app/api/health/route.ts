import { getPublicSupabaseEnvironment } from '@/lib/env';

export const dynamic = 'force-dynamic';

/** Reports application readiness without exposing credentials or dependency errors. */
export async function GET(): Promise<Response> {
  try {
    const { url, publishableKey } = getPublicSupabaseEnvironment();
    const response = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: publishableKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error('Supabase is unavailable');
    return Response.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
