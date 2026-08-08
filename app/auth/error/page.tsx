import Link from 'next/link';

const MESSAGES: Record<string, string> = {
  configuration:
    'Sign-in is not fully configured yet. Please try again later or contact your school.',
  invalid_callback:
    'That sign-in link is invalid or has expired. Please start the sign-in process again.',
  invalid_session: 'We could not verify your session. Please sign in again.',
};

function messageFor(code: string): string {
  if (MESSAGES[code]) return MESSAGES[code];
  if (code.startsWith('rejected_'))
    return 'Your account is not authorized to sign in to this school’s system.';
  return 'Sign-in could not be completed.';
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const message = messageFor(code ?? 'unknown');

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6">
      <div className="w-full max-w-[380px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#254889] text-[15px] font-bold text-white">
          M
        </div>
        <h1 className="mt-3 text-[18px] font-bold tracking-tight text-slate-900">
          Sign-in problem
        </h1>
        <p className="mt-2 text-[13.5px] text-slate-600">{message}</p>
        <Link
          href="/"
          className="bg-brand-600 hover:bg-brand-700 mt-5 flex h-9 items-center justify-center rounded-lg text-[13px] font-semibold text-white"
        >
          Back to sign-in
        </Link>
      </div>
    </main>
  );
}
