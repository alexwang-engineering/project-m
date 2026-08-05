const RELATIVE_TIME = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });
const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
];

/** Formats an ISO timestamp relative to now, e.g. "in 3 days" or "2 hours ago". */
export function formatRelativeTime(iso: string): string {
  const deltaSeconds = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    if (Math.abs(deltaSeconds) >= unitSeconds) {
      return RELATIVE_TIME.format(Math.round(deltaSeconds / unitSeconds), unit);
    }
  }
  return RELATIVE_TIME.format(Math.round(deltaSeconds), 'second');
}
