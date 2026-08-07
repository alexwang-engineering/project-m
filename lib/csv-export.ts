/**
 * A real RFC4180-shaped CSV writer with formula-injection mitigation
 * (OWASP): any cell whose value starts with =, +, -, or @ is prefixed with
 * a leading apostrophe, since a naive export of admin-entered or
 * MIS-synced free text could otherwise execute as a formula the moment a
 * school opens the file in Excel/Sheets. This is deliberately not the
 * simplified plain-split parser Package U's roster CSV reader used - that
 * one got away with simplicity because its input format was entirely this
 * project's own fixed schema; this one exports arbitrary admin-entered
 * free text with no such guarantee.
 */

const FORMULA_PREFIX_CHARS = new Set(['=', '+', '-', '@']);

function escapeCell(value: string): string {
  const guarded = FORMULA_PREFIX_CHARS.has(value[0] ?? '') ? `'${value}` : value;
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

/** Builds a CSV document (CRLF line endings, per RFC4180) from a header row and data rows. Every cell is stringified with String() before escaping. */
export function toCsv(header: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const lines = [header, ...rows].map((row) => row.map((cell) => escapeCell(String(cell ?? ''))).join(','));
  return lines.join('\r\n') + '\r\n';
}
