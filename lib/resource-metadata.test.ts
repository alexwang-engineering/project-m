import { describe, expect, it } from 'vitest';

import { labelsFromTag } from '@/lib/resource-metadata';

describe('labelsFromTag', () => {
  it('derives display labels without granting authority', () => {
    expect(labelsFromTag('Y9MA1')).toEqual({
      subject: 'Mathematics',
      year: 'Year 9',
    });
    expect(labelsFromTag('L6CH2')).toEqual({
      subject: 'Chemistry',
      year: 'Lower Sixth',
    });
    expect(labelsFromTag('CLUB')).toEqual({ subject: 'Other', year: 'Other' });
  });
});
