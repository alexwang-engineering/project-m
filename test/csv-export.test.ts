import { describe, expect, it } from 'vitest';

import { toCsv } from '@/lib/csv-export';

describe('toCsv', () => {
  it('quotes and escapes cells containing commas, quotes, or newlines', () => {
    const csv = toCsv(['a', 'b'], [['has,comma', 'has"quote'], ['line\nbreak', 'plain']]);
    expect(csv).toContain('"has,comma"');
    expect(csv).toContain('"has""quote"');
    expect(csv).toContain('"line\nbreak"');
  });

  it('neutralizes a formula-injection payload with a leading apostrophe', () => {
    const csv = toCsv(['reason'], [['=cmd|\'/C calc\'!A1']]);
    const [, dataLine] = csv.split('\r\n');
    expect(dataLine).toBe("'=cmd|'/C calc'!A1");
    expect(dataLine!.startsWith("'=")).toBe(true);
  });

  it('guards every formula-prefix character OWASP names, not just =', () => {
    // A payload with no comma/quote/newline, so only the formula guard is
    // under test here - RFC4180 quoting on top of a guarded cell is
    // covered separately below.
    for (const prefix of ['=', '+', '-', '@']) {
      const csv = toCsv(['x'], [[`${prefix}A1`]]);
      const [, dataLine] = csv.split('\r\n');
      expect(dataLine).toBe(`'${prefix}A1`);
    }
  });

  it('applies both the formula guard and RFC4180 quoting when a payload needs both', () => {
    const csv = toCsv(['x'], [['=SUM(1,2)']]);
    const [, dataLine] = csv.split('\r\n');
    expect(dataLine).toBe('"\'=SUM(1,2)"');
  });

  it('does not guard a cell that merely contains a formula-prefix character mid-string', () => {
    const csv = toCsv(['x'], [['total = 5']]);
    const [, dataLine] = csv.split('\r\n');
    expect(dataLine).toBe('total = 5');
  });

  it('renders null/undefined cells as empty strings, not the literal text "null"', () => {
    const csv = toCsv(['x'], [[null, undefined] as unknown[]]);
    const [, dataLine] = csv.split('\r\n');
    expect(dataLine).toBe(',');
  });

  it('uses CRLF line endings and ends with a trailing CRLF', () => {
    const csv = toCsv(['a'], [['1'], ['2']]);
    expect(csv).toBe('a\r\n1\r\n2\r\n');
  });
});
