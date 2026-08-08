'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

export default function ParentLoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState('');

  async function handleSubmit() {
    if (!email.trim()) return;
    setStatus('sending');
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/guardian-callback`,
      },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
      return;
    }
    setStatus('sent');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6">
      <div className="w-full max-w-[380px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#254889] text-[15px] font-bold text-white">
          M
        </div>
        <h1 className="mt-3 text-[18px] font-bold tracking-tight text-slate-900">
          Parent &amp; guardian sign-in
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          We&apos;ll email you a one-time sign-in link. You must already be
          linked to a pupil by the school.
        </p>

        {status === 'sent' ? (
          <p className="mt-5 rounded-lg bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-700">
            Check your email for a sign-in link.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-2.5">
            <input
              type="email"
              aria-label="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="focus:border-brand-400 rounded-lg border border-slate-200 px-3 py-2 text-[13.5px] text-slate-800 outline-none"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={status === 'sending' || !email.trim()}
              className="bg-brand-600 hover:bg-brand-700 flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'sending' && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Send sign-in link
            </button>
            {status === 'error' && (
              <p className="text-[12.5px] text-red-600">{message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
