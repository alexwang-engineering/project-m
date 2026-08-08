import { notFound, redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerClient } from '@/lib/supabase/server';
import { getPageForEdit, listWritableTags } from '@/lib/content/pages-editor';
import { createFileDownload } from '@/lib/files/service';
import { PageEditor } from '@/components/pages/PageEditor';
import type { BlockDraft } from '@/components/pages/block-draft';
import type { EditorBlock } from '@/lib/content/schema';
import type { Database } from '@/lib/database.types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Converts validated server blocks into the client editor's draft shape, resolving image previews. */
async function toDraftBlocks(
  client: SupabaseClient<Database>,
  blocks: readonly EditorBlock[],
): Promise<BlockDraft[]> {
  return Promise.all(
    blocks.map(async (block): Promise<BlockDraft> => {
      switch (block.type) {
        case 'paragraph':
          return { id: block.id, type: 'paragraph', html: block.html };
        case 'heading':
          return {
            id: block.id,
            type: 'heading',
            level: block.level,
            html: block.html,
          };
        case 'list':
          return {
            id: block.id,
            type: 'list',
            ordered: block.ordered,
            items: [...block.items],
          };
        case 'quote':
          return {
            id: block.id,
            type: 'quote',
            html: block.html,
            attribution: block.attribution ?? '',
          };
        case 'code':
          return {
            id: block.id,
            type: 'code',
            code: block.code,
            language: block.language ?? '',
          };
        case 'callout':
          return {
            id: block.id,
            type: 'callout',
            tone: block.tone,
            title: block.title ?? '',
            html: block.html,
          };
        case 'file':
          return {
            id: block.id,
            type: 'file',
            fileId: block.fileId,
            label: block.label,
            uploading: false,
          };
        case 'image': {
          const download = await createFileDownload(client, block.fileId);
          return {
            id: block.id,
            type: 'image',
            fileId: block.fileId,
            alt: block.alt,
            captionHtml: block.captionHtml ?? '',
            previewUrl: download.ok ? download.download.url : '',
            uploading: false,
          };
        }
      }
    }),
  );
}

export default async function EditPagePage({ params }: RouteParams) {
  const { id } = await params;
  const supabase = (await createServerClient()) as SupabaseClient<Database>;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/');

  const [page, writableTags] = await Promise.all([
    getPageForEdit(supabase, id),
    listWritableTags(supabase),
  ]);
  if (!page) notFound();

  const blocks = await toDraftBlocks(supabase, page.content.blocks);
  return (
    <PageEditor
      writableTags={writableTags}
      initial={{
        id: page.id,
        title: page.title,
        slug: page.slug,
        version: page.version,
        lifecycle: page.lifecycle,
        tagIds: page.tagIds,
        blocks,
      }}
    />
  );
}
