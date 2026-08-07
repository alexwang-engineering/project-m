'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { formatRelativeTime } from '@/lib/relative-time';
import { createFileDownloadAction } from '@/app/actions/files';
import { gradeSubmissionAction } from '@/app/actions/assignments';
import type { AssignmentDetail } from '@/lib/content/assignments';

interface SubmissionsViewProps {
  assignment: AssignmentDetail;
}

function GradeControl({
  assignmentId,
  submissionId,
  grade,
  gradeFeedback,
}: {
  assignmentId: string;
  submissionId: string;
  grade: number | null;
  gradeFeedback: string | null;
}) {
  const [value, setValue] = useState(grade === null ? '' : String(grade));
  const [feedback, setFeedback] = useState(gradeFeedback ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const parsed = Number(value);
    if (value.trim() === '' || !Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setError('Grade must be 0-100.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await gradeSubmissionAction(assignmentId, {
      submissionId,
      grade: parsed,
      feedback: feedback.trim() || undefined,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-100 pt-2.5">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="Grade"
          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-[12.5px] text-slate-800 outline-none focus:border-brand-400"
        />
        <span className="text-[11.5px] text-slate-400">/ 100</span>
        <input
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value);
            setSaved(false);
          }}
          placeholder="Feedback (optional)"
          className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[12.5px] text-slate-800 outline-none focus:border-brand-400"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex h-7 flex-shrink-0 items-center rounded-lg bg-brand-600 px-2.5 text-[11.5px] font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? 'Saved' : 'Save'}
        </button>
      </div>
      {error && <p className="text-[11px] text-[#c2483a]">{error}</p>}
    </div>
  );
}

function SubmissionRow({
  id,
  assignmentId,
  fileId,
  submittedAt,
  note,
  studentEmail,
  grade,
  gradeFeedback,
}: AssignmentDetail['submissions'][number] & { assignmentId: string }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    const result = await createFileDownloadAction(fileId);
    setDownloading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    window.open(result.download.url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-600">
            <FileText size={17} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-slate-900">
              {studentEmail ?? 'Unknown student'}
            </p>
            <p className="text-[11.5px] text-slate-500" suppressHydrationWarning>
              Submitted {formatRelativeTime(submittedAt)}
            </p>
            {note && <p className="mt-1 text-[12px] text-slate-600">{note}</p>}
            {error && <p className="mt-1 text-[11.5px] text-[#c2483a]">{error}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 transition hover:border-brand-500 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? (
            <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
          ) : (
            <Download size={14} strokeWidth={2.4} />
          )}
          Download
        </button>
      </div>
      <GradeControl assignmentId={assignmentId} submissionId={id} grade={grade} gradeFeedback={gradeFeedback} />
    </div>
  );
}

export default function SubmissionsView({ assignment }: SubmissionsViewProps) {
  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-40 flex h-[68px] items-center gap-4 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
        <Link
          href="/assignments"
          className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft size={15} strokeWidth={2.4} />
          Assignments
        </Link>
        <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">{assignment.title}</span>
      </header>

      <main className="mx-auto max-w-[720px] px-8 pb-24 pt-9">
        <div className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900">Submissions</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {assignment.submissions.length === 1
              ? '1 submission'
              : `${assignment.submissions.length} submissions`}
            {assignment.dueAt && (
              <span suppressHydrationWarning> — due {formatRelativeTime(assignment.dueAt)}</span>
            )}
          </p>
        </div>

        {assignment.submissions.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} strokeWidth={2} />}
            title="No submissions to show"
            description="Either nobody has submitted yet, or you don't manage this assignment - either way, nothing to see here."
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {assignment.submissions.map((submission) => (
              <SubmissionRow key={submission.id} assignmentId={assignment.id} {...submission} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
