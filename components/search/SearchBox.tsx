'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  FileText,
  HelpCircle,
  ClipboardList,
  Megaphone,
  CalendarDays,
  Loader2,
  Search,
} from 'lucide-react';

import { searchAction } from '@/app/actions/search';
import { useClickOutside } from '@/lib/use-click-outside';
import type { SearchResult, SearchResultKind } from '@/lib/content/search';

const DEBOUNCE_MS = 250;

const KIND_ICON: Record<SearchResultKind, typeof FileText> = {
  page: FileText,
  assignment: ClipboardList,
  quiz: HelpCircle,
  announcement: Megaphone,
  event: CalendarDays,
};

const KIND_LABEL: Record<SearchResultKind, string> = {
  page: 'Page',
  assignment: 'Assignment',
  quiz: 'Quiz',
  announcement: 'Announcement',
  event: 'Event',
};

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useClickOutside<HTMLDivElement>(() => setOpen(false));

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      searchAction(trimmed).then((found) => {
        if (!cancelled) {
          setResults(found);
          setLoading(false);
        }
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="focus-within:border-brand-400 flex h-8 w-[200px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 focus-within:bg-white">
        <Search
          size={13}
          strokeWidth={2.4}
          className="shrink-0 text-slate-400"
        />
        <input
          type="search"
          aria-label="Search pages, assignments, quizzes, announcements, and events"
          value={query}
          maxLength={200}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search"
          className="w-full bg-transparent text-[12.5px] text-slate-800 outline-none placeholder:text-slate-400"
        />
        {loading && (
          <Loader2 size={12} className="shrink-0 animate-spin text-slate-400" />
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-9 right-0 z-50 max-h-[360px] w-[320px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {results.length === 0 && !loading ? (
            <p className="px-2.5 py-3 text-[12.5px] text-slate-400">
              No results.
            </p>
          ) : (
            results.map((result) => {
              const Icon = KIND_ICON[result.kind];
              return (
                <Link
                  key={`${result.kind}:${result.id}`}
                  href={result.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2 rounded-lg px-2.5 py-2 hover:bg-slate-50"
                >
                  <Icon
                    size={14}
                    strokeWidth={2.2}
                    className="mt-0.5 shrink-0 text-slate-400"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-slate-900">
                      {result.title}
                    </p>
                    <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                      {KIND_LABEL[result.kind]}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
