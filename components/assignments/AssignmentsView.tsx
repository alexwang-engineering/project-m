'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Clock, FileUp, Loader2, Plus } from 'lucide-react';

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

function isOverdue(dueAt: string | null): boolean {
  return dueAt !== null && new Date(dueAt).getTime() < Date.now();
}

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
  const overdue = isOverdue(assignment.dueAt);
  const canSubmit =
    viewerCanSubmit &&
    (!assignment.hasSubmitted || assignment.allowResubmission);
  const working = state.status === 'working';

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-[18px] shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] leading-snug font-semibold tracking-tight text-slate-900">
            <Link
              href={`/assignments/${assignment.id}`}
              className="hover:text-brand-600 transition"
            >
              {assignment.title}
            </Link>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {assignment.tags.map((tag) => (
              <span
                key={tag.name}
                className="flex h-5 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10.5px] font-bold text-slate-500"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
        {assignment.hasSubmitted && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 size={13} strokeWidth={2.4} />
            Submitted
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
        <Clock size={13} strokeWidth={2} />
        {assignment.dueAt ? (
          <span
            className={
              overdue && !assignment.hasSubmitted
                ? 'font-semibold text-[#c2483a]'
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
          className="hover:border-brand-400 hover:text-brand-700 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-700 transition"
        >
          Read instructions: {assignment.instructions.title}
        </Link>
      )}

      {canSubmit && (
        <div className="mt-1 flex flex-col gap-2 border-t border-slate-200 pt-3">
          <textarea
            aria-label={`Submission note for ${assignment.title}`}
            value={note}
            maxLength={2000}
            rows={2}
            disabled={working}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Add a note for your teacher (optional)"
            className="focus:border-brand-400 resize-none rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] text-slate-700 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          <label className="hover:border-brand-500 hover:text-brand-600 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-[12.5px] font-medium text-slate-600 transition">
            <FileUp size={15} strokeWidth={2} />
            {state.status === 'idle' ? 'Choose a file' : state.file.name}
            <input
              type="file"
              accept=".pdf,.mpx,application/pdf,application/zip"
              className="hidden"
              disabled={working}
              onChange={(event) =>
                onSelectFile(event.target.files?.[0] ?? null)
              }
            />
          </label>

          {state.status !== 'idle' && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={working}
              className="bg-brand-600 hover:bg-brand-700 flex h-10 items-center justify-center gap-2 rounded-xl text-[12.5px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
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
            <p className="text-[11.5px] text-[#c2483a]">{state.message}</p>
          )}
        </div>
      )}
    </div>
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
    <div className="min-h-screen bg-[#f7f8fa]">
      <SkipToContentLink />
      <SubPageHeader
        backHref="/"
        backLabel="Dashboard"
        title="Assignments"
        actions={
          canCreate ? (
            <Link
              href="/assignments/new"
              className="bg-brand-600 hover:bg-brand-700 flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[12.5px] font-semibold text-white transition"
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
        className="mx-auto max-w-[900px] px-8 pt-9 pb-24"
      >
        {displayAssignments.length === 0 ? (
          <EmptyState
            icon={<FileUp size={20} strokeWidth={2} />}
            title="No assignments yet"
            description="Assignments you're set will appear here once a teacher publishes one to your tags."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
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
