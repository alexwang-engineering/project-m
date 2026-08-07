// app/[...slug]/page.tsx
//
// Canonical routing engine: pages are addressed by tag-driven hierarchy
// (e.g. /chemistry/organic-chemistry/mechanisms), never by where the user
// clicked from. This resolver always trusts `pages.canonical_url` in the
// database over the request path, and redirects when they disagree.

import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase/server';
import { PageRenderer, type BlockFileInfo } from '@/components/page-renderer';
import { createFileDownload } from '@/lib/files/service';
import { canonicalPathFromSegments } from '@/lib/content/canonical';
import { resolvePage } from '@/lib/content/repository';
import { listWritableTags } from '@/lib/content/pages-editor';
import type { Database } from '@/lib/database.types';

interface RouteParams {
  params: Promise<{ slug: string[] }>;
}

async function loadBlockFiles(
  client: SupabaseClient<Database>,
  content: { blocks: readonly { type: string; fileId?: string }[] },
): Promise<Record<string, BlockFileInfo>> {
  const fileIds = content.blocks
    .filter((block) => block.type === 'file' || block.type === 'image')
    .map((block) => block.fileId)
    .filter((id): id is string => typeof id === 'string');

  const entries = await Promise.all(
    fileIds.map(async (fileId) => {
      const result = await createFileDownload(client, fileId);
      return result.ok
        ? ([fileId, { ...result.download }] as const)
        : null;
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
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
    const { id, title, content, tagIds } = resolution.page;
    const [files, { data: userData }] = await Promise.all([
      loadBlockFiles(supabase, content),
      supabase.auth.getUser(),
    ]);
    let editHref: string | undefined;
    if (userData.user) {
      const writable = await listWritableTags(supabase);
      const writableIds = new Set(writable.map((tag) => tag.id));
      if (tagIds.length > 0 && tagIds.every((tagId) => writableIds.has(tagId))) {
        editHref = `/pages/${id}/edit`;
      }
    }
    return (
      <PageRenderer page={{ id, title, content }} files={files} editHref={editHref} />
    );
  }
  if (resolution.kind === 'redirect') redirect(resolution.destination);
  return notFound();
}
