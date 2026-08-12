'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Archive,
  Download,
  Eye,
  FileText,
  Loader2,
  Lock,
  Send,
  X,
} from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';
import { formatRelativeTime } from '@/lib/relative-time';
import { createFileDownloadAction } from '@/app/actions/files';
import {
  gradeSubmissionAction,
  releaseSubmissionGradeAction,
  setAssignmentClosedAction,
  setAssignmentExceptionAction,
  transitionAssignmentAction,
} from '@/app/actions/assignments';
import type { AssignmentDetail } from '@/lib/content/assignments';
import { PageBlocks, type BlockFileInfo } from '@/components/page-renderer';

interface SubmissionsViewProps {
  assignment: AssignmentDetail;
  instructionFiles?: Readonly<Record<string, BlockFileInfo>>;
}

function GradeControl({
  assignmentId,
  submissionId,
  grade,
  gradeFeedback,
  gradeReleasedAt,
}: {
  assignmentId: string;
  submissionId: string;
  grade: number | null;
  gradeFeedback: string | null;
  gradeReleasedAt: string | null;
}) {
  const [value, setValue] = useState(grade === null ? '' : String(grade));
  const [feedback, setFeedback] = useState(gradeFeedback ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(grade !== null);
  const [released, setReleased] = useState(gradeReleasedAt !== null);

  async function handleSave() {
    const parsed = Number(value);
    if (
      value.trim() === '' ||
      !Number.isFinite(parsed) ||
      parsed < 0 ||
      parsed > 100
    ) {
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
    setReleased(false);
  }

  async function handleRelease() {
    setSaving(true);
    setError(null);
    const result = await releaseSubmissionGradeAction(
      assignmentId,
      submissionId,
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setReleased(true);
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-slate-100 pt-2.5">
      <div className="flex items-center gap-2">
        <input
          aria-label="Grade out of 100"
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="Grade"
          className="focus:border-brand-400 w-16 rounded-lg border border-slate-200 px-2 py-1 text-[12.5px] text-slate-800 outline-none"
        />
        <span className="text-[11.5px] text-slate-400">/ 100</span>
        <input
          aria-label="Feedback"
          value={feedback}
          onChange={(e) => {
            setFeedback(e.target.value);
            setSaved(false);
          }}
          placeholder="Feedback (optional)"
          className="focus:border-brand-400 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[12.5px] text-slate-800 outline-none"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-600 hover:bg-brand-700 flex h-7 flex-shrink-0 items-center rounded-lg px-2.5 text-[11.5px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : saved && grade === null ? (
            'Saved'
          ) : (
            'Save'
          )}
        </button>
        <button
          type="button"
          onClick={handleRelease}
          disabled={saving || released || !saved}
          className="flex h-7 flex-shrink-0 items-center rounded-lg border border-slate-200 px-2.5 text-[11.5px] font-semibold text-slate-700 transition hover:border-[#254889] hover:text-[#254889] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {released ? 'Released' : 'Release'}
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
  gradeReleasedAt,
  timeline,
  canManage,
}: AssignmentDetail['submissions'][number] & {
  assignmentId: string;
  canManage: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getFile() {
    setDownloading(true);
    setError(null);
    const result = await createFileDownloadAction(fileId);
    setDownloading(false);
    if (!result.ok) {
      setError(result.message);
      return null;
    }
    return result.download;
  }

  async function handleDownload() {
    const file = await getFile();
    if (file) window.open(file.downloadUrl, '_blank', 'noopener,noreferrer');
  }

  async function handlePreview() {
    if (preview) {
      setPreview(null);
      return;
    }
    const file = await getFile();
    if (!file) return;
    if (file.mediaType !== 'application/pdf') {
      setError('Only PDF submissions can be reviewed inline.');
      return;
    }
    setPreview(file.url);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-brand-50 text-brand-600 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px]">
            <FileText size={17} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold text-slate-900">
              {studentEmail ?? 'Unknown student'}
            </p>
            <p
              className="text-[11.5px] text-slate-500"
              suppressHydrationWarning
            >
              Submitted {formatRelativeTime(submittedAt)}
            </p>
            {note && <p className="mt-1 text-[12px] text-slate-600">{note}</p>}
            {error && (
              <p className="mt-1 text-[11.5px] text-[#c2483a]">{error}</p>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={handlePreview}
              disabled={downloading}
              aria-expanded={preview !== null}
              className="hover:border-brand-500 hover:text-brand-600 flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {preview ? <X size={14} /> : <Eye size={14} />}
              {preview ? 'Close review' : 'Review PDF'}
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="hover:border-brand-500 hover:text-brand-600 flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
            ) : (
              <Download size={14} strokeWidth={2.4} />
            )}
            Download
          </button>
        </div>
      </div>
      {preview && (
        <iframe
          src={preview}
          title={`PDF submission from ${studentEmail ?? 'student'}`}
          className="mt-4 h-[70vh] min-h-[520px] w-full rounded-xl border border-slate-200 bg-slate-50"
        />
      )}
      {canManage ? (
        <GradeControl
          assignmentId={assignmentId}
          submissionId={id}
          grade={grade}
          gradeFeedback={gradeFeedback}
          gradeReleasedAt={gradeReleasedAt}
        />
      ) : (
        grade !== null && (
          <p className="mt-2 border-t border-slate-100 pt-2.5 text-[12px] text-slate-700">
            Mark: {grade}/100
            {gradeFeedback ? ` — ${gradeFeedback}` : ''}
          </p>
        )
      )}
      {canManage && timeline && timeline.length > 0 && (
        <ol
          aria-label="Submission activity"
          className="mt-3 border-t border-slate-100 pt-2 text-[11.5px] text-slate-500"
        >
          {timeline.map((event) => (
            <li key={`${event.occurredAt}-${event.action}`}>
              <span suppressHydrationWarning>
                {formatRelativeTime(event.occurredAt)}
              </span>
              {' — '}
              {event.action.replaceAll('_', ' ').replaceAll('.', ' ')}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function SubmissionsView({
  assignment,
  instructionFiles = {},
}: SubmissionsViewProps) {
  const [changingState, setChangingState] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);
  const [exception, setException] = useState<{
    studentId: string;
    withdraw: boolean;
    date: string;
    reason: string;
  } | null>(null);

  async function changeState(action: 'publish' | 'archive' | 'close') {
    if (
      action !== 'publish' &&
      !window.confirm(
        action === 'archive'
          ? 'Archive this assignment? Students will no longer see it.'
          : assignment.closedAt
            ? 'Reopen submissions for this assignment?'
            : 'Close submissions for this assignment?',
      )
    )
      return;
    setChangingState(true);
    setStateError(null);
    const result =
      action === 'close'
        ? await setAssignmentClosedAction(
            assignment.id,
            assignment.version,
            assignment.closedAt === null,
          )
        : await transitionAssignmentAction(
            assignment.id,
            assignment.version,
            action === 'publish' ? 'published' : 'archived',
          );
    setChangingState(false);
    if (!result.ok) setStateError(result.message);
    else window.location.reload();
  }

  async function saveException() {
    if (!exception) return;
    setChangingState(true);
    setStateError(null);
    const result = await setAssignmentExceptionAction(assignment.id, {
      assignmentId: assignment.id,
      studentId: exception.studentId,
      extendedDueAt: exception.date
        ? new Date(exception.date).toISOString()
        : null,
      withdraw: exception.withdraw,
      reason: exception.reason,
    });
    setChangingState(false);
    if (!result.ok) setStateError(result.message);
    else window.location.reload();
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <SkipToContentLink />
      <SubPageHeader
        backHref="/assignments"
        backLabel="Assignments"
        title={assignment.title}
        actions={
          assignment.canManage ? (
            <div className="flex items-center gap-2">
              {assignment.lifecycle === 'draft' && (
                <Link
                  href={`/assignments/${assignment.id}/preview`}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600"
                >
                  Preview as student
                </Link>
              )}
              {assignment.lifecycle === 'draft' && (
                <button
                  type="button"
                  disabled={changingState}
                  onClick={() => changeState('publish')}
                  className="bg-brand-600 flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <Send size={13} /> Publish
                </button>
              )}
              {assignment.lifecycle === 'published' && (
                <button
                  type="button"
                  disabled={changingState}
                  onClick={() => changeState('close')}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 disabled:opacity-50"
                >
                  <Lock size={13} className="mr-1 inline" />
                  {assignment.closedAt ? 'Reopen' : 'Close submissions'}
                </button>
              )}
              <button
                type="button"
                disabled={changingState}
                onClick={() => changeState('archive')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 disabled:opacity-50"
              >
                <Archive size={13} className="mr-1 inline" /> Archive
              </button>
            </div>
          ) : undefined
        }
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[720px] px-8 pt-9 pb-24"
      >
        <h1 className="sr-only">{assignment.title}</h1>
        {stateError && (
          <p role="alert" className="mb-4 text-[12px] text-red-600">
            {stateError}
          </p>
        )}
        <p className="mb-4 text-[12px] font-semibold text-slate-500">
          {assignment.lifecycle === 'draft'
            ? 'Draft — students cannot see this assignment'
            : assignment.lifecycle === 'archived'
              ? 'Archived'
              : assignment.closedAt
                ? 'Published — submissions closed'
                : assignment.availableFrom &&
                    new Date(assignment.availableFrom) > new Date()
                  ? `Published — available ${formatRelativeTime(assignment.availableFrom)}`
                  : 'Published — accepting submissions'}
        </p>
        {assignment.instructions && (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                  Instructions
                </p>
                <h2 className="mt-1 text-[18px] font-semibold text-slate-900">
                  {assignment.instructions.title}
                </h2>
              </div>
              <Link
                href={assignment.instructions.canonicalUrl}
                className="hover:border-brand-400 hover:text-brand-700 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 transition"
              >
                Open page
              </Link>
            </div>
            <PageBlocks
              content={assignment.instructions.content}
              files={instructionFiles}
            />
          </section>
        )}
        <div className="mb-6">
          <h2 className="text-[20px] font-bold tracking-tight text-slate-900">
            {assignment.canManage ? 'Submissions' : 'Your submission'}
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            {assignment.canManage
              ? assignment.submissions.length === 1
                ? '1 submission'
                : `${assignment.submissions.length} submissions`
              : assignment.submissions.length === 0
                ? 'No submission recorded'
                : 'Submitted'}
            {assignment.dueAt && (
              <span suppressHydrationWarning>
                {' '}
                — due {formatRelativeTime(assignment.dueAt)}
              </span>
            )}
          </p>
        </div>

        {assignment.canManage && assignment.roster && (
          <section
            aria-labelledby="class-status-heading"
            className="mb-6 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <h2
              id="class-status-heading"
              className="text-[15px] font-semibold text-slate-900"
            >
              Class status
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {assignment.roster.map((student) => (
                <li
                  key={student.studentId}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-[12px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-slate-700">
                      {student.studentEmail}
                    </span>
                    <span className="font-semibold text-slate-500">
                      {student.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    {student.effectiveDueAt && (
                      <span
                        className="mr-auto text-slate-500"
                        suppressHydrationWarning
                      >
                        Due {formatRelativeTime(student.effectiveDueAt)}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={changingState}
                      onClick={() =>
                        setException({
                          studentId: student.studentId,
                          withdraw: false,
                          date: '',
                          reason: '',
                        })
                      }
                      className="font-semibold text-[#254889] disabled:opacity-50"
                    >
                      Extend
                    </button>
                    <button
                      type="button"
                      disabled={changingState}
                      onClick={() =>
                        setException({
                          studentId: student.studentId,
                          withdraw: true,
                          date: '',
                          reason: '',
                        })
                      }
                      className="font-semibold text-[#9c4f43] disabled:opacity-50"
                    >
                      Withdraw
                    </button>
                  </div>
                  {exception?.studentId === student.studentId && (
                    <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3">
                      {!exception.withdraw && (
                        <input
                          type="datetime-local"
                          aria-label="Extended due date"
                          value={exception.date}
                          onChange={(event) =>
                            setException({
                              ...exception,
                              date: event.target.value,
                            })
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2"
                        />
                      )}
                      <input
                        aria-label="Exception reason"
                        placeholder="Reason (required)"
                        value={exception.reason}
                        onChange={(event) =>
                          setException({
                            ...exception,
                            reason: event.target.value,
                          })
                        }
                        className="rounded-lg border border-slate-200 px-3 py-2"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setException(null)}
                          className="rounded-lg px-3 py-2 font-semibold text-slate-500"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={
                            changingState ||
                            !exception.reason.trim() ||
                            (!exception.withdraw && !exception.date)
                          }
                          onClick={saveException}
                          className="rounded-lg bg-[#254889] px-3 py-2 font-semibold text-white disabled:opacity-50"
                        >
                          {exception.withdraw
                            ? 'Confirm withdrawal'
                            : 'Save extension'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {assignment.submissions.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} strokeWidth={2} />}
            title={
              assignment.canManage
                ? 'No submissions to show'
                : 'You have not submitted yet'
            }
            description={
              assignment.canManage
                ? 'No students have submitted this assignment yet.'
                : 'Return to the assignments list when you are ready to attach your work.'
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {assignment.submissions.map((submission) => (
              <SubmissionRow
                key={submission.id}
                assignmentId={assignment.id}
                canManage={assignment.canManage}
                {...submission}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
