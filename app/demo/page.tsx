import { ArrowRight, BookOpen, GraduationCap } from 'lucide-react';
import { SchoolBrand } from '@/components/ui/SchoolBrand';
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
    <div className="min-h-dvh bg-slate-50">
      <header className="bg-brand-600">
        <div className="mx-auto max-w-[1440px] px-6 py-5">
          <SchoolBrand />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-20">
        <p className="mb-3 text-sm font-semibold tracking-[0.2em] text-[#254889] uppercase">
          Merchant Taylors’ School
        </p>
        <h1 className="font-school text-brand-700 text-4xl tracking-tight sm:text-5xl">
          Your learning starts here
        </h1>
        <p className="mt-4 text-slate-600">
          Choose the student or teacher workspace to explore lessons,
          assignments and school life.
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
                className="group w-full rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:border-[#254889] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#254889] motion-safe:hover:-translate-y-0.5"
                type="submit"
              >
                <span className="bg-brand-50 text-brand-600 group-hover:bg-brand-600 mb-7 flex h-12 w-12 items-center justify-center rounded-lg transition-colors group-hover:text-white">
                  {role === 'teacher' ? (
                    <GraduationCap size={24} aria-hidden="true" />
                  ) : (
                    <BookOpen size={24} aria-hidden="true" />
                  )}
                </span>
                <span className="font-school text-brand-700 block text-3xl capitalize">
                  {role}
                </span>
                <span className="mt-2 block text-sm text-slate-500">
                  {role === 'teacher'
                    ? 'Plan lessons, share resources and review your classes’ work.'
                    : 'Find your lessons, complete homework and read your feedback.'}
                </span>
                <span className="text-brand-600 mt-7 flex items-center gap-2 text-sm font-semibold">
                  Enter workspace
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </button>
            </form>
          ))}
        </div>
        <p className="mt-8 text-xs leading-6 text-slate-500">
          Demo workspace · All accounts and schoolwork shown here are synthetic.
        </p>
      </main>
    </div>
  );
}
