// app/[...slug]/page.tsx
//
// Canonical routing engine: pages are addressed by tag-driven hierarchy
// (e.g. /chemistry/organic-chemistry/mechanisms), never by where the user
// clicked from. This resolver always trusts `pages.canonical_url` in the
// database over the request path, and redirects when they disagree.

import { notFound, redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { PageRenderer } from '@/components/page-renderer';

interface RouteParams {
  params: Promise<{ slug: string[] }>;
}

export default async function CanonicalPage({ params }: RouteParams) {
  const { slug } = await params;
  const requestedPath = '/' + slug.join('/');
  const supabase = await createServerClient();

  // Primary lookup: does a page's canonical_url exactly match what was requested?
  const { data: page } = await supabase
    .from('pages')
    .select('id, canonical_url, title, content_json, is_public')
    .eq('canonical_url', requestedPath)
    .maybeSingle();

  if (page) {
    // requestedPath === page.canonical_url — this IS the hierarchy position.
    return <PageRenderer page={page} />;
  }

  // Fallback: the last slug segment might be a page id, not a hierarchy path —
  // this is how notification links and old bookmarks reach a page. Resolve the
  // id, then force-redirect to where the page actually lives in the tag hierarchy.
  const lastSegment = slug[slug.length - 1];
  const { data: byId } = await supabase
    .from('pages')
    .select('canonical_url')
    .eq('id', lastSegment)
    .maybeSingle();

  if (byId?.canonical_url) {
    redirect(byId.canonical_url); // 307 — browser URL bar updates to the canonical path
  }

  notFound();
}
