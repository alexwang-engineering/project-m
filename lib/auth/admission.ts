import type { User } from '@supabase/supabase-js';

import type { InstitutionalAuthConfig } from '@/lib/auth/config';

export type AdmissionDecision =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'provider' | 'email' | 'unverified' };

/**
 * Re-checks the authenticated identity after PKCE exchange. Tenant restriction
 * is enforced at Supabase's Azure provider URL; this check provides independent
 * provider, verified-email, and exact-domain defence in depth.
 */
export function verifyInstitutionalUser(
  user: Pick<User, 'app_metadata' | 'email' | 'email_confirmed_at'>,
  config: InstitutionalAuthConfig,
): AdmissionDecision {
  const provider = user.app_metadata.provider;
  const providers = Array.isArray(user.app_metadata.providers)
    ? user.app_metadata.providers
    : [];
  if (
    provider !== 'azure' ||
    providers.length !== 1 ||
    providers[0] !== 'azure'
  ) {
    return { ok: false, code: 'provider' };
  }
  if (!user.email_confirmed_at) return { ok: false, code: 'unverified' };
  const email = user.email?.trim().toLowerCase();
  const separator = email?.lastIndexOf('@') ?? -1;
  if (
    !email ||
    separator < 1 ||
    email.slice(separator + 1) !== config.emailDomain
  ) {
    return { ok: false, code: 'email' };
  }
  return { ok: true };
}
