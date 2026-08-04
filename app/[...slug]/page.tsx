// app/[...slug]/page.tsx
//
// Canonical routing engine: pages are addressed by tag-driven hierarchy
// (e.g. /chemistry/organic-chemistry/mechanisms), never by where the user
// clicked from. This resolver always trusts `pages.canonical_url` in the
// database over the request path, and redirects when they disagree.

import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { PageRenderer } from '@/components/page-renderer';
import { canonicalPathFromSegments } from '@/lib/content/canonical';
import { resolvePage } from '@/lib/content/repository';
import type { Database } from '@/lib/database.types';

interface RouteParams {
  params: Promise<{ slug: string[] }>;
}

export default async function CanonicalPage({ params }: RouteParams) {
  const { slug } = await params;
  const requestedPath = canonicalPathFromSegments(slug);
  if (!requestedPath) notFound();
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const lastSegment = slug.at(-1);
  if (!lastSegment) notFound();
  const resolution = await resolvePage(supabase, requestedPath, lastSegment);
  if (resolution.kind === 'page') {
    const { id, title, content } = resolution.page;
    return <PageRenderer page={{ id, title, content_json: content }} />;
  }
  if (resolution.kind === 'redirect') redirect(resolution.destination);
  return notFound();
}
