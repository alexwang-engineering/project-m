'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { restoreDeletedItemAction } from '@/app/actions/recently-deleted';
import type { DeletedItem } from '@/lib/content/recently-deleted';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';

export function RecentlyDeletedView({
  items,
}: {
  items: readonly DeletedItem[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(item: DeletedItem) {
    if (!window.confirm(`Restore “${item.title}” as a draft?`)) return;
    setBusy(item.id);
    setError(null);
    const result = await restoreDeletedItemAction({
      id: item.id,
      kind: item.kind,
    });
    if (!result.ok) setError(result.message);
    setBusy(null);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SkipToContentLink />
      <SubPageHeader
        backHref="/resources"
        backLabel="Resources"
        title="Recently deleted"
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-3xl px-5 py-8 sm:px-8"
      >
        <p className="mb-6 text-sm text-slate-600">
          Items can be restored for 30 days. Restored items return as private
          drafts.
        </p>
        {error && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {items.length === 0 ? (
          <EmptyState
            icon={<RotateCcw size={19} />}
            title="Nothing to restore"
            description="Archived items you own will appear here for 30 days."
          />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {items.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-600 capitalize">
                    {item.kind} · Deleted{' '}
                    {new Date(item.deletedAt).toLocaleDateString()} · Recover by{' '}
                    {new Date(item.restoreUntil).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => restore(item)}
                  className="text-brand-600 hover:border-brand-500 shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {busy === item.id ? 'Restoring…' : 'Restore'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
