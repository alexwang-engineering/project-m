import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DemoLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (process.env.DEMO_MODE !== 'true') notFound();
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-semibold tracking-[0.2em] text-[#9c4f43] uppercase">
        Project M demo
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
        Choose a view
      </h1>
      <p className="mt-4 text-slate-600">
        Explore the same workspace with realistic student or teacher
        permissions. This demo contains synthetic data only.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          Demo sign-in is temporarily unavailable. Please try again.
        </p>
      )}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {(['student', 'teacher'] as const).map((role) => (
          <form action="/demo/login" method="post" key={role}>
            <input type="hidden" name="role" value={role} />
            <button
              className="w-full rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#9c4f43] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9c4f43]"
              type="submit"
            >
              <span className="block text-lg font-semibold text-slate-900 capitalize">
                {role}
              </span>
              <span className="mt-2 block text-sm text-slate-500">
                {role === 'teacher'
                  ? 'Create and edit content for assigned tags.'
                  : 'Read assigned pages and complete learning activities.'}
              </span>
            </button>
          </form>
        ))}
      </div>
    </main>
  );
}
