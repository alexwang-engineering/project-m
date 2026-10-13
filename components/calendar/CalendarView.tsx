'use client';

import { useState } from 'react';
import { CalendarDays, Globe2, Loader2, X } from 'lucide-react';

import { cancelCalendarEventAction } from '@/app/actions/calendar';
import { formatRelativeTime } from '@/lib/relative-time';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';
import { CreateEventForm } from '@/components/calendar/CreateEventForm';
import type { CalendarItem } from '@/lib/content/calendar';
import {
  addCalendarDays,
  calendarDateFromKey,
  keyFromCalendarDate,
  schoolDayKey,
  schoolHoursSinceMidnight,
  SCHOOL_TIME_ZONE,
} from '@/lib/school-time';

interface EditorTag {
  readonly id: string;
  readonly name: string;
}

interface CalendarViewProps {
  readonly items: readonly CalendarItem[];
  readonly writableTags: readonly EditorTag[];
  readonly currentUserId: string;
  readonly isAdmin: boolean;
  /** Server-rendered so the week anchor can't differ between server and client. */
  readonly nowIso: string;
}

/** Matches the reference's events key; keyed on the three kinds the schema actually has. */
const KIND_COLOR: Record<CalendarItem['kind'], string> = {
  event: '#2f7a6b',
  assignment: '#e2a63b',
  quiz: '#d65f5f',
};

/**
 * Foreground paired with each accent so event text clears WCAG AA; white is
 * only 2.15:1 on the amber and 3.74:1 on the coral.
 */
const ON_KIND_COLOR: Record<CalendarItem['kind'], string> = {
  event: '#ffffff',
  assignment: '#150c3d',
  quiz: '#150c3d',
};

const GRID_START_HOUR = 7;
const GRID_END_HOUR = 19;
const HOUR_HEIGHT = 52;

/** Sunday of the school week containing `key`, as a UTC-midnight calendar date. */
function startOfSchoolWeek(key: string): Date {
  const date = calendarDateFromKey(key);
  return addCalendarDays(date, -date.getUTCDay());
}

function WeekGrid({
  items,
  weekStart,
  todayKey,
}: {
  items: readonly CalendarItem[];
  weekStart: Date;
  todayKey: string;
}) {
  const days = Array.from({ length: 7 }, (_, index) =>
    addCalendarDays(weekStart, index),
  );
  const hours = Array.from(
    { length: GRID_END_HOUR - GRID_START_HOUR },
    (_, index) => GRID_START_HOUR + index,
  );

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[680px] grid-cols-[56px_repeat(7,minmax(0,1fr))]">
        <div className="border-b border-slate-200" />
        {days.map((day) => {
          const dayKey = keyFromCalendarDate(day);
          const isToday = dayKey === todayKey;
          return (
            <div
              key={dayKey}
              className={`border-b border-l border-slate-200 px-2 py-2 text-center ${isToday ? 'bg-slate-100' : ''}`}
            >
              <p className="text-[9.5px] font-bold tracking-[0.1em] text-slate-500 uppercase">
                {/* `day` is a UTC-midnight calendar date, so read it as UTC. */}
                {new Intl.DateTimeFormat('en-GB', {
                  weekday: 'short',
                  timeZone: 'UTC',
                }).format(day)}
                {isToday ? ' · Today' : ''}
              </p>
              <p className="text-[15px] font-bold text-slate-900">
                {day.getUTCDate()}
              </p>
            </div>
          );
        })}

        <div>
          {hours.map((hour) => (
            <div
              key={hour}
              style={{ height: HOUR_HEIGHT }}
              className="relative border-b border-slate-100 pr-2 text-right"
            >
              <span className="absolute -top-1.5 right-2 text-[9.5px] text-slate-400">
                {hour === 12
                  ? '12 PM'
                  : hour > 12
                    ? `${hour - 12} PM`
                    : `${hour} AM`}
              </span>
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayKey = keyFromCalendarDate(day);
          const dayItems = items.filter(
            (item) => schoolDayKey(new Date(item.at)) === dayKey,
          );
          const isToday = dayKey === todayKey;
          return (
            <div
              key={dayKey}
              className={`relative border-l border-slate-200 ${isToday ? 'bg-slate-100/60' : ''}`}
              style={{ height: hours.length * HOUR_HEIGHT }}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  style={{ height: HOUR_HEIGHT }}
                  className="border-b border-slate-100"
                />
              ))}
              {dayItems.map((item) => {
                const start = new Date(item.at);
                const end = item.endsAt ? new Date(item.endsAt) : null;
                const startHours =
                  schoolHoursSinceMidnight(start) - GRID_START_HOUR;
                const durationHours = end
                  ? Math.max(
                      0.5,
                      (end.getTime() - start.getTime()) / (1000 * 60 * 60),
                    )
                  : 0.75;
                // Clamped rather than dropped: an event outside the 07:00-19:00
                // window used to vanish from the day entirely.
                const clampedStart = Math.min(
                  Math.max(startHours, 0),
                  hours.length - 0.5,
                );
                return (
                  <div
                    key={`${item.kind}:${item.id}`}
                    className="absolute right-1 left-1 overflow-hidden rounded-md px-1.5 py-1"
                    style={{
                      top: clampedStart * HOUR_HEIGHT,
                      height: Math.min(
                        durationHours * HOUR_HEIGHT,
                        hours.length * HOUR_HEIGHT - clampedStart * HOUR_HEIGHT,
                      ),
                      backgroundColor: KIND_COLOR[item.kind],
                      color: ON_KIND_COLOR[item.kind],
                    }}
                  >
                    <p className="text-[9px] leading-tight opacity-90">
                      {new Intl.DateTimeFormat('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hourCycle: 'h23',
                        timeZone: SCHOOL_TIME_ZONE,
                      }).format(start)}
                    </p>
                    <p className="truncate text-[10.5px] leading-tight font-bold">
                      {item.title}
                    </p>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const KIND_LABEL: Record<CalendarItem['kind'], string> = {
  assignment: 'Assignment due',
  quiz: 'Quiz due',
  event: 'Event',
};

function ItemRow({
  item,
  canManage,
  cancelling,
  onCancel,
}: {
  item: CalendarItem;
  canManage: boolean;
  cancelling: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-[18px] shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-slate-500 uppercase">
            {KIND_LABEL[item.kind]}
          </span>
          {item.isBroadcast && (
            <span className="bg-brand-50 text-brand-700 flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold">
              <Globe2 size={11} strokeWidth={2.4} />
              Whole school
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[14px] leading-snug font-semibold tracking-tight text-slate-900">
          {item.title}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag.id}
              className="flex h-5 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10.5px] font-bold text-slate-500"
            >
              {tag.name}
            </span>
          ))}
        </div>
        <p
          className="mt-1.5 text-[12px] text-slate-500"
          suppressHydrationWarning
        >
          {formatRelativeTime(item.at)}
          {item.endsAt && ` – ${formatRelativeTime(item.endsAt)}`}
        </p>
      </div>
      {canManage && (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          aria-label="Cancel event"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cancelling ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <X size={14} strokeWidth={2.4} />
          )}
        </button>
      )}
    </div>
  );
}

export function CalendarView({
  items,
  writableTags,
  currentUserId,
  isAdmin,
  nowIso,
}: CalendarViewProps) {
  const [cancelledIds, setCancelledIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'week' | 'summary'>('week');
  const [weekOffset, setWeekOffset] = useState(0);

  const todayKey = schoolDayKey(new Date(nowIso));
  const weekStart = addCalendarDays(
    startOfSchoolWeek(todayKey),
    weekOffset * 7,
  );
  const weekEnd = addCalendarDays(weekStart, 6);
  // Both are UTC-midnight calendar dates, so they format as UTC.
  const weekLabel = `${new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(weekStart)} – ${new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(weekEnd)}`;

  const writableTagIds = new Set(writableTags.map((tag) => tag.id));

  async function handleCancel(eventId: string) {
    setCancellingId(eventId);
    setError(null);
    const result = await cancelCalendarEventAction({ eventId });
    setCancellingId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCancelledIds((prev) => new Set(prev).add(eventId));
  }

  const visibleItems = items.filter((item) => !cancelledIds.has(item.id));

  return (
    <div className="min-h-screen bg-slate-50">
      <SkipToContentLink />
      <SubPageHeader backHref="/" backLabel="Dashboard" title="Calendar" />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto grid max-w-[1280px] gap-5 px-4 pt-9 pb-24 sm:px-8 lg:grid-cols-[minmax(0,1fr)_280px]"
      >
        <div className="min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(30,18,88,0.05)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div
                className="flex rounded-lg border border-slate-200 p-1"
                role="group"
                aria-label="Calendar view"
              >
                {(['week', 'summary'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setView(value)}
                    aria-pressed={view === value}
                    className={`min-h-8 rounded-md px-4 text-[12.5px] font-semibold capitalize ${
                      view === value
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              {view === 'week' && (
                <div className="flex items-center gap-3">
                  {/*
                    listUpcoming only loads from the start of today, so earlier
                    weeks can never be populated - offering the control would
                    just navigate to a silently empty grid. Browsing history
                    needs a range-aware loader.
                  */}
                  <button
                    type="button"
                    disabled={weekOffset <= 0}
                    title={
                      weekOffset <= 0
                        ? 'Past weeks are not loaded yet'
                        : undefined
                    }
                    onClick={() => setWeekOffset((value) => value - 1)}
                    className="text-accent-purple text-[12.5px] font-semibold hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline disabled:hover:no-underline"
                  >
                    &#9664; Prev week
                  </button>
                  <p className="font-display text-[15px] font-extrabold text-slate-900">
                    {weekLabel}
                  </p>
                  <button
                    type="button"
                    onClick={() => setWeekOffset((value) => value + 1)}
                    className="text-accent-purple text-[12.5px] font-semibold hover:underline"
                  >
                    Next week &#9654;
                  </button>
                </div>
              )}
            </div>

            {view === 'week' && (
              <div
                role="region"
                aria-label={`Week of ${weekLabel}`}
                tabIndex={0}
              >
                <WeekGrid
                  items={visibleItems}
                  weekStart={weekStart}
                  todayKey={todayKey}
                />
              </div>
            )}
          </div>
        </div>

        <aside className="grid content-start gap-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(30,18,88,0.05)]">
            <h2 className="font-display mb-3 text-[17px] font-extrabold text-slate-900">
              Events key
            </h2>
            <ul className="grid gap-2.5">
              {(
                [
                  ['event', 'School events'],
                  ['assignment', 'Assignments due'],
                  ['quiz', 'Quizzes due'],
                ] as const
              ).map(([kind, label]) => (
                <li
                  key={kind}
                  className="flex items-center gap-2.5 text-[12.5px] text-slate-700"
                >
                  <span
                    className="h-4 w-4 rounded"
                    style={{ backgroundColor: KIND_COLOR[kind] }}
                    aria-hidden="true"
                  />
                  {label}
                </li>
              ))}
            </ul>
          </section>
        </aside>

        {/*
          This list is the Summary view: the same items the week grid renders
          visually, in an accessible linear form. The toggle switches between
          the two rather than leaving one option inert.
        */}
        <div className="min-w-0 lg:col-start-1">
          {/* Creating an event is available from either view, so it sits outside the toggle. */}
          {(isAdmin || writableTags.length > 0) && (
            <CreateEventForm writableTags={writableTags} isAdmin={isAdmin} />
          )}

          {error && <p className="mb-4 text-[12.5px] text-red-600">{error}</p>}

          {view === 'summary' &&
            (visibleItems.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={20} strokeWidth={2} />}
                title="Nothing upcoming"
                description="Deadlines and events for your tags will appear here as they're scheduled."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {visibleItems.map((item) => {
                  const canManage =
                    item.kind === 'event' &&
                    (item.createdBy === currentUserId ||
                      isAdmin ||
                      item.tags.some((tag) => writableTagIds.has(tag.id)));
                  return (
                    <ItemRow
                      key={`${item.kind}:${item.id}`}
                      item={item}
                      canManage={canManage}
                      cancelling={cancellingId === item.id}
                      onCancel={() => handleCancel(item.id)}
                    />
                  );
                })}
              </div>
            ))}
        </div>
      </main>
    </div>
  );
}
