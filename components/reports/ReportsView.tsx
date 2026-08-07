'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';

import { getAuditLogAction } from '@/app/actions/reports';
import { toCsv } from '@/lib/csv-export';
import type { AuditLogEntry } from '@/lib/content/reports';
import type { ContentSummary, RosterSummary } from '@/lib/content/reports';

interface ReportsViewProps {
  readonly rosterSummary: RosterSummary;
  readonly contentSummary: ContentSummary;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[22px] font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ReportsView({ rosterSummary, contentSummary }: ReportsViewProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [entries, setEntries] = useState<readonly AuditLogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runQuery() {
    setLoading(true);
    setError(null);
    const result = await getAuditLogAction({
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      action: action.trim() || undefined,
      targetType: targetType.trim() || undefined,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEntries(result.data);
  }

  function exportCsv() {
    if (!entries) return;
    const csv = toCsv(
      ['id', 'actorEmail', 'action', 'targetType', 'targetId', 'createdAt'],
      entries.map((e) => [e.id, e.actorEmail ?? '', e.action, e.targetType, e.targetId ?? '', e.createdAt]),
    );
    downloadCsv(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="sticky top-0 z-40 flex h-[68px] items-center gap-4 border-b border-slate-200 bg-white/85 px-8 backdrop-blur">
        <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition hover:text-slate-900">
          <ArrowLeft size={15} strokeWidth={2.4} />
          Admin
        </Link>
        <span className="text-[15.5px] font-semibold tracking-tight text-slate-900">Reports</span>
      </header>

      <main className="mx-auto max-w-[900px] px-8 pb-24 pt-9">
        <p className="mb-6 text-[12.5px] text-slate-500">
          Operational reporting only, not a compliance export — see ADR-017. For GDPR data-subject or safeguarding
          audit exports, a named human privacy reviewer must be involved before anything ships.
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-[14px] font-semibold tracking-tight text-slate-900">Roster</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {rosterSummary.byRole.map((r) => (
              <StatCard key={r.role} label={r.role} value={r.count} />
            ))}
            {rosterSummary.byState.map((s) => (
              <StatCard key={s.state} label={s.state} value={s.count} />
            ))}
          </div>
          {rosterSummary.byTag.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">Members per tag</p>
              <div className="flex flex-wrap gap-1.5">
                {rosterSummary.byTag.map((t) => (
                  <span
                    key={t.tagName}
                    className="flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-600"
                  >
                    {t.tagName}
                    <span className="text-slate-400">{t.memberCount}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-[14px] font-semibold tracking-tight text-slate-900">Content</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {contentSummary.pagesByLifecycle.map((p) => (
              <StatCard key={p.lifecycle} label={`Pages: ${p.lifecycle}`} value={p.count} />
            ))}
            <StatCard label="Assignments" value={contentSummary.assignments} />
            <StatCard label="Quizzes" value={contentSummary.quizzes} />
            <StatCard label="Announcements" value={contentSummary.announcements} />
            <StatCard label="Calendar events" value={contentSummary.calendarEvents} />
            <StatCard label="Submissions" value={contentSummary.submissions} />
            <StatCard label="Quiz attempts" value={contentSummary.quizAttempts} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-[14px] font-semibold tracking-tight text-slate-900">Audit log</h2>
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <label htmlFor="report-from" className="mb-1 block text-[11px] font-semibold text-slate-500">From</label>
              <input id="report-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px]" />
            </div>
            <div>
              <label htmlFor="report-to" className="mb-1 block text-[11px] font-semibold text-slate-500">To</label>
              <input id="report-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px]" />
            </div>
            <div>
              <label htmlFor="report-action" className="mb-1 block text-[11px] font-semibold text-slate-500">Action</label>
              <input id="report-action" value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. quiz.created" className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px]" />
            </div>
            <div>
              <label htmlFor="report-target-type" className="mb-1 block text-[11px] font-semibold text-slate-500">Target type</label>
              <input id="report-target-type" value={targetType} onChange={(e) => setTargetType(e.target.value)} placeholder="e.g. quiz" className="rounded-lg border border-slate-200 px-2 py-1.5 text-[12.5px]" />
            </div>
            <button
              type="button"
              onClick={runQuery}
              disabled={loading}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading && <Loader2 size={12} className="animate-spin" />}
              Run
            </button>
            {entries && (
              <button
                type="button"
                onClick={exportCsv}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-600 hover:border-slate-300"
              >
                <Download size={12} strokeWidth={2.4} />
                Export CSV
              </button>
            )}
          </div>
          {error && <p className="mb-3 text-[12.5px] text-red-600">{error}</p>}
          {entries && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Actor</th>
                    <th className="px-3 py-2">Action</th>
                    <th className="px-3 py-2">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                        No matching audit events.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-50 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500">{new Date(entry.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2 text-slate-700">{entry.actorEmail ?? '—'}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{entry.action}</td>
                        <td className="px-3 py-2 text-slate-500">{entry.targetType}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
