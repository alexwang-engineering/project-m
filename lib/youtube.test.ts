import { describe, expect, it } from 'vitest';

import { normalizeYouTubeVideoId } from '@/lib/youtube';

describe('normalizeYouTubeVideoId', () => {
  it('accepts supported IDs and URLs while rejecting alternate hosts and playlists', () => {
    expect(normalizeYouTubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(normalizeYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=2')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(
      normalizeYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBe('dQw4w9WgXcQ');
    expect(
      normalizeYouTubeVideoId(
        'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
      ),
    ).toBeNull();
    expect(
      normalizeYouTubeVideoId(
        'https://youtube.com/watch?v=dQw4w9WgXcQ&list=PL123',
      ),
    ).toBeNull();
    expect(
      normalizeYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ/extra'),
    ).toBeNull();
    expect(
      normalizeYouTubeVideoId('https://youtube.com/embed/dQw4w9WgXcQ/extra'),
    ).toBeNull();
  });
});
