'use client';

export default function ResourcesError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-8 py-24 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">
        Resources could not be loaded
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Your access has not changed. Try loading the page again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-brand-600 mt-6 rounded-xl px-4 py-2 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </main>
  );
}
