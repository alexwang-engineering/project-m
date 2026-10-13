'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileUp,
  Loader2,
  Plus,
} from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';
import { formatRelativeTime } from '@/lib/relative-time';
import { createClient } from '@/lib/supabase/client';
import { beginFileUploadAction } from '@/app/actions/files';
import { submitAssignmentAction } from '@/app/actions/assignments';
import { sha256Hex } from '@/lib/files/client-hash';
import { waitForFileReady } from '@/lib/files/poll-status';
import type { AssignmentSummary } from '@/lib/content/assignments';

interface AssignmentsViewProps {
  assignments: readonly AssignmentSummary[];
  canCreate: boolean;
}

type SubmissionStep =
  'hashing' | 'starting' | 'uploading' | 'verifying' | 'recording';

type SubmissionState =
  | { readonly status: 'idle' }
  | { readonly status: 'selected'; readonly file: File }
  | {
      readonly status: 'working';
      readonly file: File;
      readonly step: SubmissionStep;
    }
  | { readonly status: 'error'; readonly file: File; readonly message: string };

const STEP_LABEL: Record<SubmissionStep, string> = {
  hashing: 'Checking file…',
  starting: 'Preparing upload…',
  uploading: 'Uploading…',
  verifying: 'Verifying upload…',
  recording: 'Recording submission…',
};

async function submitFile(
  assignmentId: string,
  file: File,
  note: string,
): Promise<
  { ok: true } | { ok: false; message: string; step: SubmissionStep }
> {
  const mediaType =
    file.type === 'application/pdf'
      ? 'application/pdf'
      : 'application/octet-stream';
  const sha256 = await sha256Hex(file).catch(() => null);
  if (!sha256)
    return { ok: false, message: 'Could not read this file.', step: 'hashing' };

  const ticket = await beginFileUploadAction({
    filename: file.name,
    sizeBytes: file.size,
    sha256,
    mediaType,
  });
  if (!ticket.ok)
    return { ok: false, message: ticket.message, step: 'starting' };

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(ticket.file.bucket)
    .upload(ticket.file.objectName, file, {
      contentType: mediaType,
      upsert: false,
    });
  if (uploadError)
    return { ok: false, message: uploadError.message, step: 'uploading' };

  const verified = await waitForFileReady(ticket.file.id);
  if (!verified.ok)
    return { ok: false, message: verified.message, step: 'verifying' };

  const submitted = await submitAssignmentAction({
    assignmentId,
    fileId: ticket.file.id,
    note: note.trim() || undefined,
  });
  if (!submitted.ok)
    return { ok: false, message: submitted.message, step: 'recording' };

  return { ok: true };
}

function AssignmentCard({
  assignment,
  viewerCanSubmit,
  state,
  onSelectFile,
  note,
  onNoteChange,
  onSubmit,
}: {
  assignment: AssignmentSummary;
  viewerCanSubmit: boolean;
  state: SubmissionState;
  onSelectFile: (file: File | null) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const boundaries = [
      assignment.availableFrom ? Date.parse(assignment.availableFrom) : NaN,
      assignment.dueAt ? Date.parse(assignment.dueAt) + 1 : NaN,
    ];
    const next = Math.min(...boundaries.filter((at) => at > now));
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(0, next - Date.now()), 2_147_483_647),
    );
    return () => clearTimeout(timer);
  }, [assignment.availableFrom, assignment.dueAt, now]);
  const overdue =
    assignment.dueAt !== null && new Date(assignment.dueAt).getTime() < now;
  const unavailableReason =
    assignment.lifecycle !== 'published'
      ? 'This assignment is not published.'
      : assignment.closedAt !== null
        ? 'Submissions are closed.'
        : assignment.availableFrom !== null &&
            new Date(assignment.availableFrom).getTime() > now
          ? 'This assignment is not open yet.'
          : overdue
            ? 'The submission deadline has passed.'
            : null;
  const canSubmit =
    viewerCanSubmit &&
    unavailableReason === null &&
    (!assignment.hasSubmitted || assignment.allowResubmission);
  const working = state.status === 'working';

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl leading-snug font-semibold tracking-tight text-slate-900">
            <Link
              href={`/assignments/${assignment.id}`}
              className="hover:text-brand-600 transition"
            >
              {assignment.title}
            </Link>
          </h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {assignment.tags.map((tag) => (
              <span
                key={tag.name}
                className="bg-brand-50 text-brand-700 rounded-md px-2 py-1 text-xs font-medium"
                title={tag.name}
              >
                {tag.displayName || tag.name}
              </span>
            ))}
          </div>
        </div>
        {assignment.hasSubmitted && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={13} strokeWidth={2.4} />
            Submitted
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Clock size={13} strokeWidth={2} />
        {assignment.dueAt ? (
          <span
            className={
              overdue && !assignment.hasSubmitted
                ? 'font-semibold text-red-700'
                : ''
            }
            suppressHydrationWarning
          >
            Due {formatRelativeTime(assignment.dueAt)}
          </span>
        ) : (
          <span>No deadline</span>
        )}
      </div>

      {assignment.instructions && (
        <Link
          href={assignment.instructions.canonicalUrl}
          className="hover:border-brand-500 hover:text-brand-700 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700 transition"
        >
          Read instructions: {assignment.instructions.title}
        </Link>
      )}

      {viewerCanSubmit && unavailableReason && (
        <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
          {unavailableReason}
        </p>
      )}

      {viewerCanSubmit &&
        (canSubmit || state.status !== 'idle' || note.length > 0) && (
          <div className="mt-1 flex flex-col gap-3 border-t border-slate-200 pt-4">
            <textarea
              aria-label={`Submission note for ${assignment.title}`}
              value={note}
              maxLength={2000}
              rows={2}
              disabled={working || !canSubmit}
              onChange={(event) => onNoteChange(event.target.value)}
              placeholder="Add a note for your teacher (optional)"
              className="focus:border-brand-500 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 text-slate-700 placeholder:text-slate-500 disabled:opacity-60"
            />
            <label className="hover:border-brand-500 hover:text-brand-600 focus-within:ring-brand-500 relative flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition focus-within:ring-2 focus-within:ring-offset-2">
              <FileUp size={15} strokeWidth={2} />
              <span className="min-w-0 truncate">
                {state.status === 'idle' ? 'Choose a file' : state.file.name}
              </span>
              <input
                type="file"
                aria-label={`Choose a file for ${assignment.title}`}
                accept=".pdf,.mpx,application/pdf,application/zip"
                className="sr-only"
                disabled={working || !canSubmit}
                onChange={(event) =>
                  onSelectFile(event.target.files?.[0] ?? null)
                }
              />
            </label>

            {state.status !== 'idle' && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={working || !canSubmit}
                className="bg-brand-600 hover:bg-brand-700 flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {working ? (
                  <>
                    <Loader2
                      size={15}
                      strokeWidth={2.4}
                      className="animate-spin"
                    />
                    {STEP_LABEL[state.step]}
                  </>
                ) : assignment.hasSubmitted ? (
                  'Resubmit'
                ) : (
                  'Submit'
                )}
              </button>
            )}

            {state.status === 'error' && (
              <p role="alert" className="text-sm text-red-700">
                {state.message}
              </p>
            )}
          </div>
        )}
      <Link
        href={`/assignments/${assignment.id}`}
        className="text-brand-600 hover:text-brand-700 mt-auto flex min-h-11 items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm font-semibold"
      >
        {viewerCanSubmit ? 'View assignment & feedback' : 'Review assignment'}
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
}

export default function AssignmentsView({
  assignments,
  canCreate,
}: AssignmentsViewProps) {
  const [states, setStates] = useState<Record<string, SubmissionState>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<ReadonlySet<string>>(new Set());

  function stateFor(id: string): SubmissionState {
    return states[id] ?? { status: 'idle' };
  }

  function handleSelectFile(assignmentId: string, file: File | null) {
    setStates((prev) => ({
      ...prev,
      [assignmentId]: file ? { status: 'selected', file } : { status: 'idle' },
    }));
  }

  async function handleSubmit(assignmentId: string) {
    const current = stateFor(assignmentId);
    if (current.status !== 'selected' && current.status !== 'error') return;
    const file = current.file;

    setStates((prev) => ({
      ...prev,
      [assignmentId]: { status: 'working', file, step: 'hashing' },
    }));
    const result = await submitFile(
      assignmentId,
      file,
      notes[assignmentId] ?? '',
    );
    if (result.ok) {
      setStates((prev) => ({ ...prev, [assignmentId]: { status: 'idle' } }));
      setNotes((prev) => ({ ...prev, [assignmentId]: '' }));
      setCompleted((prev) => new Set(prev).add(assignmentId));
    } else {
      setStates((prev) => ({
        ...prev,
        [assignmentId]: { status: 'error', file, message: result.message },
      }));
    }
  }

  const displayAssignments = assignments.map((assignment) =>
    completed.has(assignment.id)
      ? { ...assignment, hasSubmitted: true }
      : assignment,
  );

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <SkipToContentLink />
      <SubPageHeader
        backHref="/"
        backLabel="Dashboard"
        title="Assignments"
        actions={
          canCreate ? (
            <Link
              href="/assignments/new"
              className="bg-brand-600 hover:bg-brand-700 flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white transition"
            >
              <Plus size={14} strokeWidth={2.4} />
              New assignment
            </Link>
          ) : undefined
        }
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[1280px] px-4 pt-10 pb-24 sm:px-8"
      >
        <div className="mb-8">
          <p className="text-brand-600 text-xs font-semibold tracking-[0.16em] uppercase">
            {canCreate ? 'Teaching & learning' : 'Your schoolwork'}
          </p>
          <h2 className="font-school text-brand-700 mt-2 text-4xl leading-tight tracking-tight">
            {canCreate ? 'Work for your classes' : 'Homework & classwork'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {canCreate
              ? 'Set assignments, review submissions and share feedback with your pupils.'
              : 'See what’s due, read the instructions and hand in your work. Open an assignment to see your feedback.'}
          </p>
        </div>
        {displayAssignments.length === 0 ? (
          <EmptyState
            icon={<FileUp size={20} strokeWidth={2} />}
            title="No assignments yet"
            description={
              canCreate
                ? 'Create an assignment to set work for your classes.'
                : 'Work from your teachers will appear here when it’s ready for your class.'
            }
          />
        ) : (
          <div className="grid items-start gap-5 md:grid-cols-2">
            {displayAssignments.map((assignment) => (
              <AssignmentCard
                key={assignment.id}
                assignment={assignment}
                viewerCanSubmit={!canCreate}
                state={stateFor(assignment.id)}
                onSelectFile={(file) => handleSelectFile(assignment.id, file)}
                note={notes[assignment.id] ?? ''}
                onNoteChange={(note) =>
                  setNotes((previous) => ({
                    ...previous,
                    [assignment.id]: note,
                  }))
                }
                onSubmit={() => handleSubmit(assignment.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
