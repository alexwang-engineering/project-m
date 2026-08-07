'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';

import { importMigrationManifestAction } from '@/app/actions/migration';
import { parseMigrationManifest } from '@/lib/content/migration-parse';
import type { MigrationManifest, MigrationReportEntry } from '@/lib/content/migration-types';

const STATUS_LABEL: Record<MigrationReportEntry['status'], string> = {
  imported: 'Imported',
  unchanged: 'Unchanged',
  conflict: 'Conflict',
  quarantined: 'Quarantined',
  failed: 'Failed',
  would_import: 'Would import',
};

const STATUS_COLOR: Record<MigrationReportEntry['status'], string> = {
  imported: 'text-emerald-600',
  unchanged: 'text-slate-400',
  conflict: 'text-amber-600',
  quarantined: 'text-amber-600',
  failed: 'text-red-600',
  would_import: 'text-brand-600',
};

export function MigrationImportPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [manifest, setManifest] = useState<MigrationManifest | null>(null);
  const [parseErrors, setParseErrors] = useState<readonly string[]>([]);
  const [report, setReport] = useState<readonly MigrationReportEntry[] | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleFile(file: File) {
    setFileName(file.name);
    setReport(null);
    setError(null);
    setApplied(false);
    const text = await file.text();
    const parsed = parseMigrationManifest(text);
    setManifest(parsed.manifest);
    setParseErrors(parsed.errors);
  }

  async function run(dryRun: boolean) {
    if (!manifest) return;
    setBusy(dryRun ? 'preview' : 'apply');
    setError(null);
    const activeRunId = runId ?? crypto.randomUUID();
    setRunId(activeRunId);
    const result = await importMigrationManifestAction(manifest, activeRunId, dryRun);
    setBusy(null);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setReport(result);
    if (!dryRun) setApplied(true);
  }

  const itemCount = manifest ? manifest.resources.length + manifest.assignments.length + manifest.quizzes.length : 0;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-1 text-[13px] font-semibold text-slate-900">Content migration import</p>
      <p className="mb-3 text-[12.5px] text-slate-600">
        Upload a migration manifest (JSON with <code className="rounded bg-slate-100 px-1">resources</code>,{' '}
        <code className="rounded bg-slate-100 px-1">assignments</code>, and{' '}
        <code className="rounded bg-slate-100 px-1">quizzes</code> arrays, each item tagged to an existing tag by
        name). Every item becomes a draft page/assignment/quiz - review and publish manually. Re-uploading the same
        manifest skips anything unchanged; a changed item is reported as a conflict, never silently overwritten.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:border-slate-300"
        >
          <Upload size={12} strokeWidth={2.4} />
          {fileName ?? 'Choose manifest (.json)'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {manifest && (
          <>
            <span className="text-[12px] text-slate-400">
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => run(true)}
              disabled={itemCount === 0 || busy !== null}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-[12px] font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'preview' && <Loader2 size={12} className="animate-spin" />}
              Preview (dry run)
            </button>
            {report && !applied && (
              <button
                type="button"
                onClick={() => run(false)}
                disabled={busy !== null}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'apply' && <Loader2 size={12} className="animate-spin" />}
                Apply
              </button>
            )}
          </>
        )}
      </div>

      {parseErrors.length > 0 && (
        <ul className="mt-3 flex flex-col gap-0.5">
          {parseErrors.map((e, i) => (
            <li key={i} className="text-[12.5px] text-red-600">
              {e}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}

      {report && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-[12.5px] font-semibold text-slate-900">{applied ? 'Applied' : 'Preview'}</p>
          <ul className="flex flex-col gap-1">
            {report.map((entry) => (
              <li key={`${entry.kind}:${entry.externalId}`} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="truncate text-slate-700">
                  <span className="text-slate-400">[{entry.kind}]</span> {entry.title}
                </span>
                <span className={`shrink-0 font-semibold ${STATUS_COLOR[entry.status]}`}>
                  {STATUS_LABEL[entry.status]}
                  {entry.message ? ` — ${entry.message}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
