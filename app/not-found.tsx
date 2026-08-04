import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-8">
      <section className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-[#254889]">404</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The page may have moved, been archived, or may not be available to
          you.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-[#254889] px-4 py-2 text-sm font-semibold text-white"
        >
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
