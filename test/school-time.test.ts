import { describe, expect, it } from 'vitest';

import {
  addCalendarDays,
  calendarDateFromKey,
  keyFromCalendarDate,
  schoolDayKey,
  schoolHoursSinceMidnight,
} from '@/lib/school-time';

/**
 * These cases fail if the date maths uses the runtime's own zone. They are
 * written against instants where the server zone and Europe/London disagree,
 * which is where timetable entries previously landed on the wrong day or an
 * hour out through BST.
 */
describe('school time', () => {
  it('puts a late-evening UTC instant on the next London day during BST', () => {
    // 23:30 UTC on 13 Aug is 00:30 on 14 Aug in London (BST = UTC+1).
    expect(schoolDayKey(new Date('2026-08-13T23:30:00.000Z'))).toBe(
      '2026-08-14',
    );
  });

  it('keeps a winter instant on the same day when London is on GMT', () => {
    expect(schoolDayKey(new Date('2026-01-13T23:30:00.000Z'))).toBe(
      '2026-01-13',
    );
  });

  it('reads a lesson start in London wall-clock hours, not the server zone', () => {
    // 08:00 UTC is a 09:00 lesson in London during BST.
    expect(schoolHoursSinceMidnight(new Date('2026-08-13T08:00:00.000Z'))).toBe(
      9,
    );
    // 08:30 UTC in winter is 08:30 London.
    expect(schoolHoursSinceMidnight(new Date('2026-01-13T08:30:00.000Z'))).toBe(
      8.5,
    );
  });

  it('adds calendar days without drifting across a DST boundary', () => {
    // BST ended on 25 Oct 2026; stepping across it must still advance one day.
    const beforeChange = calendarDateFromKey('2026-10-24');
    expect(keyFromCalendarDate(addCalendarDays(beforeChange, 1))).toBe(
      '2026-10-25',
    );
    expect(keyFromCalendarDate(addCalendarDays(beforeChange, 2))).toBe(
      '2026-10-26',
    );
  });

  it('round-trips a calendar key', () => {
    expect(keyFromCalendarDate(calendarDateFromKey('2026-08-13'))).toBe(
      '2026-08-13',
    );
  });
});
