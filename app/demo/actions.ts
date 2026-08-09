'use server';

import { redirect } from 'next/navigation';

import { createServerClient } from '@/lib/supabase/server';

/** Signs into one of the two synthetic, least-privilege demo accounts. */
export async function signInAsDemo(formData: FormData) {
  if (process.env.DEMO_MODE !== 'true') redirect('/');

  const role = formData.get('role');
  if (role !== 'student' && role !== 'teacher') redirect('/demo?error=role');

  const email = process.env[`DEMO_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`DEMO_${role.toUpperCase()}_PASSWORD`];
  if (!email || !password) redirect('/demo?error=configuration');

  const { error } = await (
    await createServerClient()
  ).auth.signInWithPassword({
    email,
    password,
  });
  if (error) redirect('/demo?error=signin');
  redirect('/');
}
