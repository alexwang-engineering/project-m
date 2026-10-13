'use client';

import Link from 'next/link';
import { BookOpen, FileText, Search } from 'lucide-react';
import { useState } from 'react';

import type { ResourceSummary } from '@/lib/content/resources';
import { formatRelativeTime } from '@/lib/relative-time';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkipToContentLink } from '@/components/ui/SkipToContentLink';
import { SubPageHeader } from '@/components/ui/SubPageHeader';

export function ResourcesView({
  resources,
  role,
  classes,
}: {
  resources: readonly ResourceSummary[];
  role: 'admin' | 'teacher' | 'student';
  classes: readonly { name: string; displayName: string }[];
}) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
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
        className="mx-auto max-w-[1280px] px-4 py-8 sm:px-8"
      >
        <div className="mb-6 rounded-[20px] border border-slate-200 bg-white p-6 sm:p-8">
          {/*
            Reference shows a folder path (Resources / Academic / Chemistry / GCSE / Bonds),
            but there is no folder hierarchy in the schema yet - this reflects the one real
            level plus the active class filter rather than a fixed decorative path.
          */}
          <div className="text-accent-purple mb-5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] uppercase">
            <span>Resources</span>
            {tag && (
              <>
                <span aria-hidden="true">/</span>
                <span>{tag}</span>
              </>
            )}
          </div>
          <h2 className="font-display text-[28px] font-extrabold tracking-[-0.02em] text-slate-900 sm:text-[38px]">
            {isStaff ? 'Your teaching library' : 'Your learning library'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {isStaff
              ? 'Lesson materials, drafts and quizzes for the classes you teach.'
              : 'Lesson notes, quizzes and revision for the classes you’re enrolled in.'}
          </p>
        </div>
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search resources</span>
            <Search
              className="absolute top-3.5 left-3 text-slate-500"
              size={16}
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search resources"
              className="focus:border-brand-500 min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm"
            />
          </label>
          <label>
            <span className="sr-only">Filter by class</span>
            <select
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm sm:w-48"
            >
              <option value="">All my classes</option>
              {classes.map(({ name, displayName }) => (
                <option key={name} value={name}>
                  {displayName} · {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mb-4 text-sm text-slate-600" role="status">
          {filtered.length} {filtered.length === 1 ? 'resource' : 'resources'}
          {tag ? ` · ${tag}` : ''}
        </p>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Search size={19} />}
            title="No resources found"
            description="Try another search or class."
          />
        ) : isStaff ? (
          <div
            role="region"
            aria-label="Scrollable resource management table"
            tabIndex={0}
            className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white"
          >
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Resources available to you</caption>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wide text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Classes</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((resource) => (
                  <tr
                    key={`${resource.type}-${resource.id}`}
                    className="hover:bg-slate-50"
                  >
                    <th className="px-4 py-4 font-semibold text-slate-900">
                      <Link
                        className="hover:text-brand-600"
                        href={resource.href}
                      >
                        {resource.title}
                      </Link>
                    </th>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] uppercase ${
                          resource.type === 'quiz'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-emerald-50 text-[#2f7a6b]'
                        }`}
                      >
                        {resource.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {resource.tags.map((item) => item.name).join(', ') ||
                        'Whole school'}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] uppercase ${
                          resource.lifecycle === 'published'
                            ? 'bg-slate-100 text-slate-600'
                            : 'text-accent-purple bg-violet-50'
                        }`}
                      >
                        {resource.lifecycle}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatRelativeTime(resource.updatedAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
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
            {filtered.map((resource) => {
              const isQuiz = resource.type === 'quiz';
              return (
                <Link
                  key={`${resource.type}-${resource.id}`}
                  href={resource.href}
                  className="group flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <span
                    aria-hidden="true"
                    className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${
                      isQuiz
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-emerald-50 text-[#2f7a6b]'
                    }`}
                  >
                    {isQuiz ? <BookOpen size={16} /> : <FileText size={16} />}
                  </span>
                  <h3 className="text-[14px] leading-snug font-bold text-slate-900">
                    {resource.title}
                  </h3>
                  <p className="mt-1 text-[11.5px] text-slate-500">
                    {resource.tags
                      .map((item) => item.displayName || item.name)
                      .join(' · ') || 'Whole school'}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] uppercase ${
                        isQuiz
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-emerald-50 text-[#2f7a6b]'
                      }`}
                    >
                      {isQuiz ? 'Quiz' : 'Topic'}
                    </span>
                    <span
                      className="text-[10.5px] text-slate-500"
                      suppressHydrationWarning
                    >
                      {formatRelativeTime(resource.updatedAt)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
