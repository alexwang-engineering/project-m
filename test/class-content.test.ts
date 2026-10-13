import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/lib/database.types';
import { listClassTags } from '@/lib/content/classes';
import {
  getCurrentUserSummary,
  listDashboardPages,
} from '@/lib/content/dashboard';
import { listResources } from '@/lib/content/resources';

const user = {
  id: '10000000-0000-4000-8000-000000000001',
  email: 'pupil@merchanttaylors.com',
};
const ownTag = {
  id: '20000000-0000-4000-8000-000000000001',
  tag_name: 'Y9MA1',
  display_name: 'Year 9 Mathematics',
};
const otherTag = {
  id: '20000000-0000-4000-8000-000000000002',
  tag_name: 'Y10EN1',
  display_name: 'Year 10 English',
};
const sharedPage = {
  id: '30000000-0000-4000-8000-000000000001',
  title: 'Shared revision',
  canonical_url: '/revision',
  lifecycle: 'published',
  content_json: { schemaVersion: 1, blocks: [] },
  updated_at: '2026-09-12T12:00:00Z',
  page_tags: [
    { tag_id: otherTag.id, tags: otherTag },
    { tag_id: ownTag.id, tags: ownTag },
  ],
  class_scope: [{ tag_id: ownTag.id }],
};

// Real SDK, mocked transport: these verify requests/projections, not database RLS.
function clientReturning(responses: Record<string, unknown>) {
  const requests: URL[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    requests.push(url);
    if (!(url.pathname in responses))
      throw new Error(`Unexpected request: ${url.pathname}`);
    const body = responses[url.pathname];
    return body instanceof Response
      ? body
      : new Response(JSON.stringify(body), {
          headers: { 'Content-Type': 'application/json' },
        });
  });
  const client = createClient<Database>('https://school.example', 'test-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: crypto.randomUUID(),
    },
    global: { fetch, headers: { Authorization: 'Bearer test-token' } },
  });
  return { client, requests, fetch };
}

afterEach(() => vi.useRealTimers());

describe('class content requests and projection', () => {
  it('loads only the signed-in pupil’s current member tags and deduplicates them', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-12T12:00:00Z'));
    const { client, requests } = clientReturning({
      '/auth/v1/user': user,
      '/rest/v1/tag_memberships': [
        { tags: ownTag },
        { tags: ownTag },
        { tags: null },
      ],
    });
    await expect(listClassTags(client, 'student')).resolves.toEqual([
      {
        id: ownTag.id,
        name: ownTag.tag_name,
        displayName: ownTag.display_name,
      },
    ]);
    const params = requests.find((url) =>
      url.pathname.endsWith('/tag_memberships'),
    )!.searchParams;
    expect(params.get('profile_id')).toBe(`eq.${user.id}`);
    expect(params.get('membership_role')).toBe('eq.member');
    expect(params.get('tags.is_active')).toBe('eq.true');
    expect(params.get('valid_from')).toBe('lte.2026-09-12T12:00:00.000Z');
    expect(params.get('or')).toBe(
      '(valid_until.is.null,valid_until.gt.2026-09-12T12:00:00.000Z)',
    );
    expect(params.get('select')).toBe('tags!inner(id,tag_name,display_name)');
  });

  it.each(['teacher', 'admin'] as const)(
    'preserves the existing %s authoring class scope',
    async (role) => {
      const { client, requests } = clientReturning({
        '/rest/v1/rpc/current_principal_is_admin': role === 'admin',
        '/rest/v1/tags': [ownTag, otherTag],
        '/rest/v1/tag_memberships': [{ tags: ownTag }],
      });
      const tags = await listClassTags(client, role);
      expect(tags.map((tag) => tag.id)).toEqual(
        role === 'admin' ? [ownTag.id, otherTag.id] : [ownTag.id],
      );
      if (role === 'admin') {
        expect(
          requests
            .find((url) => url.pathname === '/rest/v1/tags')!
            .searchParams.get('is_active'),
        ).toBe('eq.true');
      } else {
        expect(
          requests
            .find((url) => url.pathname.endsWith('/tag_memberships'))!
            .searchParams.get('membership_role'),
        ).toBe('in.(teacher,manager)');
      }
    },
  );

  it('does not load pupil memberships when authentication fails', async () => {
    const { client, requests } = clientReturning({
      '/auth/v1/user': new Response(
        JSON.stringify({ message: 'Invalid session' }),
        { status: 401 },
      ),
    });
    await expect(listClassTags(client, 'student')).resolves.toEqual([]);
    expect(requests.map((url) => url.pathname)).toEqual(['/auth/v1/user']);
  });

  it('restricts role lookup to the authenticated profile even when RLS could expose other profiles', async () => {
    const { client, requests } = clientReturning({
      '/auth/v1/user': user,
      '/rest/v1/role_assignments': [{ role: 'teacher' }],
    });
    await expect(getCurrentUserSummary(client)).resolves.toEqual({
      email: user.email,
      role: 'teacher',
    });
    expect(
      requests
        .find((url) => url.pathname.endsWith('/role_assignments'))!
        .searchParams.get('profile_id'),
    ).toBe(`eq.${user.id}`);
  });

  it('filters parent dashboard rows by class before limiting and trims only displayed audience metadata', async () => {
    const { client, requests } = clientReturning({
      '/rest/v1/pages': [sharedPage],
    });
    const pages = await listDashboardPages(client, [ownTag.id], 12);
    const params = requests[0]!.searchParams;
    expect(params.get('class_scope.tag_id')).toBe(`in.(${ownTag.id})`);
    expect(params.get('class_scope')).toBe('not.is.null');
    expect(params.get('limit')).toBe('12');
    expect(params.get('select')).toContain('class_scope:page_tags(tag_id)');
    expect(params.get('select')).toContain(
      'page_tags(tag_id,tags(tag_name,display_name))',
    );
    expect(pages[0]).toMatchObject({
      canonicalUrl: '/revision',
      tags: [{ name: ownTag.tag_name, displayName: ownTag.display_name }],
    });
  });

  it('retains full shared audience IDs for resource management, including tags without readable metadata', async () => {
    const ownPage = {
      ...sharedPage,
      id: '30000000-0000-4000-8000-000000000002',
      page_tags: [{ tag_id: ownTag.id, tags: ownTag }],
    };
    const quiz = {
      id: '40000000-0000-4000-8000-000000000001',
      title: 'Shared quiz',
      created_at: sharedPage.updated_at,
      quiz_tags: [
        { tag_id: otherTag.id, tags: null },
        { tag_id: ownTag.id, tags: ownTag },
      ],
      class_scope: [{ tag_id: ownTag.id }],
    };
    const { client, requests } = clientReturning({
      '/rest/v1/pages': [sharedPage, ownPage],
      '/rest/v1/quizzes': [quiz],
    });
    const resources = await listResources(
      client,
      'teacher',
      new Set([ownTag.id]),
      [ownTag.id],
    );
    expect(
      resources.find((item) => item.id === sharedPage.id)?.manageHref,
    ).toBeNull();
    expect(
      resources.find((item) => item.id === quiz.id)?.manageHref,
    ).toBeNull();
    expect(resources.find((item) => item.id === ownPage.id)?.manageHref).toBe(
      `/pages/${ownPage.id}/edit`,
    );
    for (const resource of resources) {
      expect(resource.tags).toEqual([
        { name: ownTag.tag_name, displayName: ownTag.display_name },
      ]);
      expect(resource.subject).toBe('Mathematics');
    }
    for (const request of requests) {
      expect(request.searchParams.get('class_scope.tag_id')).toBe(
        `in.(${ownTag.id})`,
      );
      expect(request.searchParams.get('class_scope')).toBe('not.is.null');
      expect(request.searchParams.get('limit')).toBe('100');
    }
  });

  it('returns no class content without making a request when no classes are assigned', async () => {
    const { client, fetch } = clientReturning({});
    await expect(listDashboardPages(client, [])).resolves.toEqual([]);
    await expect(
      listResources(client, 'student', new Set(), []),
    ).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves unscoped administrator content and management', async () => {
    const { client, requests } = clientReturning({
      '/rest/v1/pages': [sharedPage],
      '/rest/v1/quizzes': [],
    });
    const pages = await listDashboardPages(client, null);
    const resources = await listResources(client, 'admin', new Set(), null);
    expect(pages[0]?.tags).toHaveLength(2);
    expect(resources[0]?.tags).toHaveLength(2);
    expect(resources[0]?.manageHref).toBe(`/pages/${sharedPage.id}/edit`);
    for (const request of requests) {
      expect(request.searchParams.has('class_scope.tag_id')).toBe(false);
      expect(request.searchParams.has('class_scope')).toBe(false);
    }
  });
});
