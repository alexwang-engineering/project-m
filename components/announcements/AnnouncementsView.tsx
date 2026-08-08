'use client';

import { useState } from 'react';
import { Globe2, Loader2, Megaphone, X } from 'lucide-react';

import { cancelAnnouncementAction } from '@/app/actions/announcements';
import { formatRelativeTime } from '@/lib/relative-time';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';
import { CreateAnnouncementForm } from '@/components/announcements/CreateAnnouncementForm';
import type { Announcement } from '@/lib/content/announcements';

interface EditorTag {
  readonly id: string;
  readonly name: string;
}

interface AnnouncementsViewProps {
  readonly announcements: readonly Announcement[];
  readonly writableTags: readonly EditorTag[];
  readonly currentUserId: string;
  readonly isAdmin: boolean;
}

function AnnouncementCard({
  announcement,
  canManage,
  cancelling,
  onCancel,
}: {
  announcement: Announcement;
  canManage: boolean;
  cancelling: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-[18px] shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          {announcement.isBroadcast && (
            <span className="bg-brand-50 text-brand-700 flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-bold">
              <Globe2 size={11} strokeWidth={2.4} />
              Whole school
            </span>
          )}
          <span className="text-[12px] text-slate-500" suppressHydrationWarning>
            {formatRelativeTime(announcement.createdAt)}
          </span>
        </div>
        <p className="mt-1.5 text-[14px] leading-snug font-semibold tracking-tight text-slate-900">
          {announcement.title}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-wrap text-slate-600">
          {announcement.body}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {announcement.tags.map((tag) => (
            <span
              key={tag.id}
              className="flex h-5 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10.5px] font-bold text-slate-500"
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>
      {canManage && (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          aria-label="Retract announcement"
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

export function AnnouncementsView({
  announcements,
  writableTags,
  currentUserId,
  isAdmin,
}: AnnouncementsViewProps) {
  const [cancelledIds, setCancelledIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const writableTagIds = new Set(writableTags.map((tag) => tag.id));

  async function handleCancel(announcementId: string) {
    setCancellingId(announcementId);
    setError(null);
    const result = await cancelAnnouncementAction({ announcementId });
    setCancellingId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCancelledIds((prev) => new Set(prev).add(announcementId));
  }

  const visible = announcements.filter((a) => !cancelledIds.has(a.id));

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SkipToContentLink />
      <SubPageHeader backHref="/" backLabel="Dashboard" title="Announcements" />

      <main id="main-content" className="mx-auto max-w-[900px] px-8 pt-9 pb-24">
        <CreateAnnouncementForm writableTags={writableTags} isAdmin={isAdmin} />

        {error && <p className="mb-4 text-[12.5px] text-red-600">{error}</p>}

        {visible.length === 0 ? (
          <EmptyState
            icon={<Megaphone size={20} strokeWidth={2} />}
            title="No announcements yet"
            description="Posts from your teachers and the school will appear here."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((announcement) => {
              const canManage =
                announcement.createdBy === currentUserId ||
                isAdmin ||
                announcement.tags.some((tag) => writableTagIds.has(tag.id));
              return (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  canManage={canManage}
                  cancelling={cancellingId === announcement.id}
                  onCancel={() => handleCancel(announcement.id)}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
