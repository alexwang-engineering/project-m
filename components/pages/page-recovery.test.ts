import { describe, expect, it } from 'vitest';

import {
  parsePageRecovery,
  serializePageRecovery,
} from '@/components/pages/page-recovery';

describe('page recovery', () => {
  it('round-trips bounded state and rejects malformed or oversized data', () => {
    const serialized = serializePageRecovery({
      pageId: 'page',
      baseVersion: 2,
      title: 'Recovered title',
      slug: 'recovered-title',
      tagIds: ['tag'],
      blocks: [{ id: 'b1', type: 'paragraph', html: '<b>Draft</b>' }],
    });
    expect(serialized).not.toBeNull();
    expect(parsePageRecovery(serialized!)?.title).toBe('Recovered title');
    expect(parsePageRecovery('{"blocks":"wrong"}')).toBeNull();
    expect(parsePageRecovery('x'.repeat(500_001))).toBeNull();
  });
});
