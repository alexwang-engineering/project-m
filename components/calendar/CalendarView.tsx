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

interface EditorTag {
  readonly id: string;
  readonly name: string;
}

interface CalendarViewProps {
  readonly items: readonly CalendarItem[];
  readonly writableTags: readonly EditorTag[];
  readonly currentUserId: string;
  readonly isAdmin: boolean;
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
}: CalendarViewProps) {
  const [cancelledIds, setCancelledIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="min-h-screen bg-[#f7f8fa]">
      <SkipToContentLink />
      <SubPageHeader backHref="/" backLabel="Dashboard" title="Calendar" />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[900px] px-8 pt-9 pb-24"
      >
        {(isAdmin || writableTags.length > 0) && (
          <CreateEventForm writableTags={writableTags} isAdmin={isAdmin} />
        )}

        {error && <p className="mb-4 text-[12.5px] text-red-600">{error}</p>}

        {visibleItems.length === 0 ? (
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
        )}
      </main>
    </div>
  );
}
