import { NextResponse } from 'next/server';

import { createServerClient } from '@/lib/supabase/server';

/** Signs into one synthetic demo account using a browser-native HTML form. */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (process.env.DEMO_MODE !== 'true')
    return new NextResponse(null, { status: 404 });

  const role = (await request.formData()).get('role');
  if (role !== 'student' && role !== 'teacher')
    return NextResponse.redirect(`${origin}/demo?error=role`, 303);

  const email = process.env[`DEMO_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`DEMO_${role.toUpperCase()}_PASSWORD`];
  if (!email || !password)
    return NextResponse.redirect(`${origin}/demo?error=configuration`, 303);

  const { error } = await (
    await createServerClient()
  ).auth.signInWithPassword({
    email,
    password,
  });
  return NextResponse.redirect(
    error ? `${origin}/demo?error=signin` : origin,
    303,
  );
}
