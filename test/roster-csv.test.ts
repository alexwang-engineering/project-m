import { describe, expect, it } from 'vitest';

import { MAX_ROSTER_ROWS, parseRosterCsv } from '@/lib/content/roster-csv';

describe('parseRosterCsv', () => {
  it('rejects more rows than the database import ceiling', () => {
    const row = 'student@merchanttaylors.com,student,Y9MA1';
    const parsed = parseRosterCsv(
      ['email,systemRole,tags', ...Array(MAX_ROSTER_ROWS + 1).fill(row)].join(
        '\n',
      ),
    );

    expect(parsed.rows).toEqual([]);
    expect(parsed.parseErrors[0]).toContain(`${MAX_ROSTER_ROWS} rows`);
  });
});
