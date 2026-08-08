'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';

import { syncRosterAction } from '@/app/actions/roster-sync';
import {
  MAX_ROSTER_FILE_BYTES,
  parseRosterCsv,
  type RosterRow,
} from '@/lib/content/roster-csv';
import type { RosterSyncReport } from '@/lib/content/roster-sync';

const fieldClass = 'text-[12.5px] text-slate-600';

function ReportList({
  title,
  items,
  empty,
}: {
  title: string;
  items: readonly string[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-[11.5px] font-bold tracking-wide text-slate-500 uppercase">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-[12.5px] text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-1 flex flex-col gap-0.5">
          {items.map((item, i) => (
            <li key={i} className="truncate text-[12.5px] text-slate-700">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RosterSyncPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<readonly RosterRow[]>([]);
  const [parseErrors, setParseErrors] = useState<readonly string[]>([]);
  const [report, setReport] = useState<RosterSyncReport | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleFile(file: File) {
    setFileName(file.name);
    setReport(null);
    setError(null);
    setApplied(false);
    if (file.size > MAX_ROSTER_FILE_BYTES) {
      setRows([]);
      setParseErrors(['The roster CSV must be 5 MB or smaller.']);
      return;
    }
    const text = await file.text();
    const parsed = parseRosterCsv(text);
    setRows(parsed.rows);
    setParseErrors(parsed.parseErrors);
  }

  async function runSync(dryRun: boolean) {
    setBusy(dryRun ? 'preview' : 'apply');
    setError(null);
    const result = await syncRosterAction(rows, dryRun);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setReport(result.report);
    if (!dryRun) setApplied(true);
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
      <p className="mb-1 text-[13px] font-semibold text-slate-900">
        Roster sync
      </p>
      <p className={`mb-3 ${fieldClass}`}>
        Upload a CSV (header:{' '}
        <code className="rounded bg-slate-100 px-1">email,systemRole,tags</code>
        , tags like{' '}
        <code className="rounded bg-slate-100 px-1">
          Y10MA1:member;Y11SCI:teacher
        </code>
        ) to reconcile roles and tag memberships. Preview the diff before
        applying it - nothing is written until you apply.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:border-slate-300"
        >
          <Upload size={12} strokeWidth={2.4} />
          {fileName ?? 'Choose CSV'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        {fileName && (
          <>
            <span className="text-[12px] text-slate-400">
              {rows.length} valid row{rows.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => runSync(true)}
              disabled={rows.length === 0 || busy !== null}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-[12px] font-semibold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'preview' && (
                <Loader2 size={12} className="animate-spin" />
              )}
              Preview (dry run)
            </button>
            {report && !applied && (
              <button
                type="button"
                onClick={() => runSync(false)}
                disabled={busy !== null}
                className="bg-brand-600 hover:bg-brand-700 flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'apply' && (
                  <Loader2 size={12} className="animate-spin" />
                )}
                Apply
              </button>
            )}
          </>
        )}
      </div>

      {parseErrors.length > 0 && (
        <div className="mt-3">
          <ReportList title="File parse errors" items={parseErrors} empty="" />
        </div>
      )}
      {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}

      {report && (
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
          <p className="col-span-2 text-[12.5px] font-semibold text-slate-900">
            {applied ? 'Applied' : 'Preview'}: {report.rowsProcessed} rows
            processed, {report.peopleValidated} people validated
          </p>
          <ReportList
            title="Role grants"
            items={report.roleGrants.map((g) => `${g.email} → ${g.role}`)}
            empty="None"
          />
          <ReportList
            title="Membership grants"
            items={report.membershipGrants.map(
              (g) => `${g.email} → ${g.tag} (${g.role})`,
            )}
            empty="None"
          />
          <ReportList
            title="Membership closures"
            items={report.membershipClosures.map(
              (c) => `${c.email} ← ${c.tag} (${c.role})`,
            )}
            empty="None"
          />
          <ReportList
            title="Accounts to disable"
            items={report.accountsToDisable.map((a) => a.email)}
            empty="None"
          />
          <ReportList
            title="Queued (not yet signed in)"
            items={report.intentsQueued.map((q) => `${q.email} (${q.role})`)}
            empty="None"
          />
          <ReportList
            title="Row errors"
            items={report.errors.map((e) => `${e.email}: ${e.error}`)}
            empty="None"
          />
        </div>
      )}
    </div>
  );
}
