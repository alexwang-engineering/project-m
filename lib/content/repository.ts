import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database, Json } from '@/lib/database.types';
import {
  parseEditorDocument,
  type EditorDocumentV1,
} from '@/lib/content/schema';
import { isUuid } from '@/lib/content/canonical';

type Client = SupabaseClient<Database>;

export interface ContentPage {
  readonly id: string;
  readonly canonicalUrl: string;
  readonly title: string;
  readonly content: EditorDocumentV1;
  readonly lifecycle: Database['public']['Enums']['content_state'];
  readonly isPublic: boolean;
  readonly version: number;
}

export type PageResolution =
  | { readonly kind: 'page'; readonly page: ContentPage }
  | { readonly kind: 'redirect'; readonly destination: string }
  | { readonly kind: 'not_found' };

function pageFromRow(row: {
  id: string;
  canonical_url: string;
  title: string;
  content_json: Json;
  lifecycle: Database['public']['Enums']['content_state'];
  is_public: boolean;
  version: number;
}): ContentPage {
  return {
    id: row.id,
    canonicalUrl: row.canonical_url,
    title: row.title,
    content: parseEditorDocument(row.content_json),
    lifecycle: row.lifecycle,
    isPublic: row.is_public,
    version: row.version,
  };
}

/** Resolves a canonical path, historical redirect, or UUID deep link under RLS. */
export async function resolvePage(
  client: Client,
  path: string,
  lastSegment: string,
): Promise<PageResolution> {
  const { data: page, error: pageError } = await client
    .from('pages')
    .select(
      'id, canonical_url, title, content_json, lifecycle, is_public, version',
    )
    .eq('canonical_url', path)
    .maybeSingle();
  if (pageError) throw pageError;
  if (page) return { kind: 'page', page: pageFromRow(page) };

  const { data: historical, error: redirectError } = await client
    .from('canonical_redirects')
    .select('pages!inner(canonical_url)')
    .eq('old_path', path)
    .maybeSingle();
  if (redirectError) throw redirectError;
  const historicalPage = historical?.pages;
  if (historicalPage && !Array.isArray(historicalPage)) {
    return { kind: 'redirect', destination: historicalPage.canonical_url };
  }

  if (isUuid(lastSegment)) {
    const { data: byId, error: idError } = await client
      .from('pages')
      .select('canonical_url')
      .eq('id', lastSegment)
      .maybeSingle();
    if (idError) throw idError;
    if (byId) return { kind: 'redirect', destination: byId.canonical_url };
  }

  return { kind: 'not_found' };
}
