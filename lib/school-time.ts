/**
 * The school runs on Europe/London wall-clock time. Doing date arithmetic with
 * the runtime's own zone (getHours/toDateString) while formatting labels in
 * Europe/London makes the two disagree: on a UTC server that is an hour out
 * through BST, and puts events on the wrong day either side of midnight.
 */
export const SCHOOL_TIME_ZONE = 'Europe/London';

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHOOL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHOOL_TIME_ZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
});

/** `YYYY-MM-DD` identifying which school day an instant falls on. */
export function schoolDayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

/** Hours since school-local midnight as a float, so 09:30 becomes 9.5. */
export function schoolHoursSinceMidnight(date: Date): number {
  const [hour, minute] = clockFormatter.format(date).split(':').map(Number);
  return (hour ?? 0) + (minute ?? 0) / 60;
}

/**
 * A `YYYY-MM-DD` key as a UTC-midnight Date. Calendar grids need plain date
 * arithmetic (add a day, find the weekday) with no zone drift, so they build
 * from these rather than from zoned instants.
 */
export function calendarDateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

/** Inverse of `calendarDateFromKey` for a UTC-midnight calendar date. */
export function keyFromCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds whole days to a UTC-midnight calendar date. */
export function addCalendarDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * An instant at or just before midnight London on the school day containing
 * `now`. London runs at UTC+0 or UTC+1, so stepping an hour back from the day
 * key's UTC midnight always lands at or before true local midnight. The bound
 * is deliberately generous: an hour early is harmless, an hour late would drop
 * the first lesson of the day.
 */
export function startOfSchoolToday(now: Date = new Date()): Date {
  const dayStart = calendarDateFromKey(schoolDayKey(now));
  return new Date(dayStart.getTime() - 60 * 60 * 1000);
}
