'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarDays, Globe2, GraduationCap, Megaphone } from 'lucide-react';

import { formatRelativeTime } from '@/lib/relative-time';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';
import type {
  Pupil,
  PupilAnnouncement,
  PupilCalendarItem,
  PupilGrade,
} from '@/lib/content/guardians';

export interface PupilData {
  readonly pupil: Pupil;
  readonly calendar: readonly PupilCalendarItem[];
  readonly announcements: readonly PupilAnnouncement[];
  readonly grades: readonly PupilGrade[];
}

interface ParentViewProps {
  readonly pupilData: readonly PupilData[];
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-900">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function PupilPanel({ data }: { data: PupilData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Section
        icon={<CalendarDays size={15} strokeWidth={2.2} />}
        title="Upcoming"
      >
        {data.calendar.length === 0 ? (
          <p className="text-[12.5px] text-slate-400">Nothing upcoming.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.calendar.map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                <p className="text-[12.5px] font-semibold text-slate-800">
                  {item.title}
                </p>
                <p
                  className="text-[11.5px] text-slate-500"
                  suppressHydrationWarning
                >
                  {formatRelativeTime(item.occursAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={<Megaphone size={15} strokeWidth={2.2} />}
        title="Announcements"
      >
        {data.announcements.length === 0 ? (
          <p className="text-[12.5px] text-slate-400">No announcements.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.announcements.map((a) => (
              <li key={a.id}>
                <div className="flex items-center gap-1.5">
                  {a.isBroadcast && (
                    <Globe2
                      size={11}
                      strokeWidth={2.4}
                      className="text-brand-600"
                    />
                  )}
                  <p className="text-[12.5px] font-semibold text-slate-800">
                    {a.title}
                  </p>
                </div>
                <p className="mt-0.5 text-[12px] text-slate-600">{a.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={<GraduationCap size={15} strokeWidth={2.2} />}
        title="Grades"
      >
        {data.grades.length === 0 ? (
          <p className="text-[12.5px] text-slate-400">No grades yet.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.grades.map((g) => (
              <li key={g.submissionId}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-semibold text-slate-800">
                    {g.assignmentTitle}
                  </p>
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    {g.grade}/100
                  </span>
                </div>
                {g.gradeFeedback && (
                  <p className="mt-0.5 text-[12px] text-slate-600">
                    {g.gradeFeedback}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export function ParentView({ pupilData }: ParentViewProps) {
  const [selectedId, setSelectedId] = useState(pupilData[0]?.pupil.id ?? null);
  const selected =
    pupilData.find((d) => d.pupil.id === selectedId) ?? pupilData[0];

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SkipToContentLink />
      <SubPageHeader title="Parent view" />

      <main id="main-content" className="mx-auto max-w-[900px] px-8 pt-9 pb-24">
        {pupilData.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={20} strokeWidth={2} />}
            title="No linked pupils"
            description="Ask the school to link your account to your child before anything appears here."
          />
        ) : (
          <>
            {pupilData.length > 1 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {pupilData.map((d) => (
                  <button
                    key={d.pupil.id}
                    type="button"
                    onClick={() => setSelectedId(d.pupil.id)}
                    className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                      selected?.pupil.id === d.pupil.id
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {d.pupil.email}
                  </button>
                ))}
              </div>
            )}
            {selected && <PupilPanel data={selected} />}
          </>
        )}
      </main>
    </div>
  );
}
