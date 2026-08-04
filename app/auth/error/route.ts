import { NextResponse } from 'next/server';

/** Temporary non-sensitive error endpoint; Claude may replace it with the final UX. */
export function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code') ?? 'unknown';
  return NextResponse.json(
    { error: 'Sign-in could not be completed.', code },
    { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
