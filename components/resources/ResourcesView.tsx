'use client';

import Link from 'next/link';
import { BookOpen, FileText, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { ResourceSummary } from '@/lib/content/resources';
import { formatRelativeTime } from '@/lib/relative-time';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';

export function ResourcesView({
  resources,
  role,
}: {
  resources: readonly ResourceSummary[];
  role: 'admin' | 'teacher' | 'student';
}) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const tags = useMemo(
    () =>
      [
        ...new Set(
          resources.flatMap((resource) =>
            resource.tags.map((item) => item.name),
          ),
        ),
      ].sort(),
    [resources],
  );
  const filtered = resources.filter((resource) => {
    const needle = query.trim().toLowerCase();
    return (
      (!tag || resource.tags.some((item) => item.name === tag)) &&
      (!needle ||
        resource.title.toLowerCase().includes(needle) ||
        resource.subject.toLowerCase().includes(needle) ||
        resource.tags.some((item) => item.name.toLowerCase().includes(needle)))
    );
  });
  const isStaff = role !== 'student';

  return (
    <div className="min-h-[100dvh] bg-slate-50">
      <SkipToContentLink />
      <SubPageHeader
        backHref="/"
        backLabel="Dashboard"
        title="Resources"
        actions={
          isStaff ? (
            <Link
              href="/recently-deleted"
              className="hover:border-brand-500 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Recently deleted
            </Link>
          ) : undefined
        }
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8"
      >
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search resources</span>
            <Search
              className="absolute top-2.5 left-3 text-slate-400"
              size={16}
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search resources"
              className="focus:border-brand-500 min-h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm outline-none"
            />
          </label>
          <label>
            <span className="sr-only">Filter by tag</span>
            <select
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-48"
            >
              <option value="">All tags</option>
              {tags.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Search size={19} />}
            title="No resources found"
            description="Try another search or tag."
          />
        ) : isStaff ? (
          <div
            role="region"
            aria-label="Scrollable resource management table"
            tabIndex={0}
            className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
          >
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Resources available to you</caption>
              <thead className="border-b border-slate-200 bg-slate-100 text-xs tracking-wide text-slate-700 uppercase">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((resource) => (
                  <tr key={`${resource.type}-${resource.id}`}>
                    <th className="px-4 py-3 font-semibold text-slate-900">
                      <Link
                        className="hover:text-brand-600"
                        href={resource.href}
                      >
                        {resource.title}
                      </Link>
                    </th>
                    <td className="px-4 py-3 text-slate-600 capitalize">
                      {resource.type}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {resource.tags.map((item) => item.name).join(', ') ||
                        'Whole school'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 capitalize">
                      {resource.lifecycle}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatRelativeTime(resource.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {resource.manageHref && (
                        <Link
                          className="text-brand-600 hover:text-brand-700 font-semibold"
                          href={resource.manageHref}
                        >
                          Manage
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((resource) => (
              <Link
                key={`${resource.type}-${resource.id}`}
                href={resource.href}
                className="hover:border-brand-500 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="bg-brand-50 text-brand-600 mb-4 flex h-9 w-9 items-center justify-center rounded-lg">
                  {resource.type === 'page' ? (
                    <FileText size={18} />
                  ) : (
                    <BookOpen size={18} />
                  )}
                </span>
                <span className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                  {resource.year} · {resource.subject}
                </span>
                <h2 className="mt-1.5 text-lg font-semibold text-slate-900">
                  {resource.title}
                </h2>
                <p className="mt-3 text-xs text-slate-600">
                  {resource.tags.map((item) => item.name).join(' · ')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
