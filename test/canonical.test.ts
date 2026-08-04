import { describe, expect, it } from 'vitest';

import { canonicalPathFromSegments, isUuid } from '@/lib/content/canonical';

describe('canonical path validation', () => {
  it('accepts normalized hierarchy segments', () => {
    expect(
      canonicalPathFromSegments([
        'chemistry',
        'organic-chemistry',
        'mechanisms',
      ]),
    ).toBe('/chemistry/organic-chemistry/mechanisms');
  });

  it.each<[readonly string[]]>([
    [[]],
    [['Chemistry']],
    [['chemistry', '..', 'admin']],
    [['chemistry', 'double--dash']],
    [['chemistry', 'encoded%2fslash']],
  ])('rejects malformed segments: %j', (segments) => {
    expect(canonicalPathFromSegments(segments)).toBeNull();
  });

  it('recognizes only UUID deep links', () => {
    expect(isUuid('10000000-0000-4000-8000-000000000001')).toBe(true);
    expect(isUuid('mechanisms')).toBe(false);
  });
});
