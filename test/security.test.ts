import { describe, expect, it } from 'vitest';

import { sanitizeEditorHtml, verifyTagAccess } from '@/lib/security';

describe('security primitives', () => {
  it('removes executable HTML', () => {
    const clean = sanitizeEditorHtml(
      '<p onclick="alert(1)">Safe<script>alert(1)</script><a href="javascript:alert(1)">link</a></p>',
    );

    expect(clean).not.toMatch(/onclick|script|javascript:/i);
    expect(clean).toContain('Safe');
  });

  it('keeps only approved Word-style font sizes', () => {
    const clean = sanitizeEditorHtml(
      '<span style="font-size: 14pt">Large</span><span style="font-size: 99pt; color: red">Unsafe</span>',
    );

    expect(clean).toContain('font-size:14pt');
    expect(clean).not.toMatch(/99pt|color/i);
  });

  it('requires every requested tag and denies empty sets', () => {
    expect(verifyTagAccess(['L6CH2', 'Y9MA1'], ['y9ma1'])).toBe(true);
    expect(verifyTagAccess(['L6CH2'], ['Y9MA1'])).toBe(false);
    expect(verifyTagAccess([], [])).toBe(false);
  });
});
